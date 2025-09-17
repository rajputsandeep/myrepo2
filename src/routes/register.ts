// src/routes/register.ts
import express, { Request, Response, NextFunction } from "express";
import { Repository, In } from "typeorm";
import bcrypt from "bcrypt";

import { AppDataSource } from "../dataSource/data-source";
import { createError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { allowRoles } from "../middleware/roleGuard";

import { Superadmin } from "../entities/SuperAdmin";
import { Client } from "../entities/Client";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { LicenseAllocation } from "../entities/LicenseAllocation";
import { send2FACode } from "../services/mailer";
import { validatePassword } from "../utils/passwordPolicy";
import { LicenseTypeMaster } from "../entities/LicenseTypeMaster";
import { BillingDetail } from "../entities/BillingDetail";
import { ClientIntegration } from "../entities/ClientIntegration";
import { IntegrationSecret } from "../entities/IntegrationSecret";
import { encryptSecret } from "../utils/kmsHelper";

import {normalizeIntegrationsInput} from "../helpers/functions"

const router = express.Router();

const SuperadminRepo = (): Repository<Superadmin> =>
  AppDataSource.getRepository(Superadmin);
const ClientRepo = (): Repository<Client> => AppDataSource.getRepository(Client);
const UserRepo = (): Repository<User> => AppDataSource.getRepository(User);
const RoleRepo = (): Repository<Role> => AppDataSource.getRepository(Role);

async function findRoleByNameCaseInsensitive(name: string, clientId?: string | null) {
  const lowerName = (name || "").toLowerCase();

  // 1) global role
  const globalRole = await RoleRepo()
    .createQueryBuilder("r")
    .leftJoinAndSelect("r.client", "client")
    .where("LOWER(r.name) = :name", { name: lowerName })
    .andWhere("r.isGlobal = :isGlobal", { isGlobal: true })
    .getOne();

  if (globalRole) return globalRole;

  // 2) client-scoped role (if clientId provided)
  if (clientId) {
    const clientRole = await RoleRepo()
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.client", "client")
      .where("LOWER(r.name) = :name", { name: lowerName })
      .andWhere("client.clientId = :clientId", { clientId })
      .getOne();
    if (clientRole) return clientRole;
  }

  // 3) fallback: any role with that name
  return RoleRepo()
    .createQueryBuilder("r")
    .leftJoinAndSelect("r.client", "client")
    .where("LOWER(r.name) = :name", { name: lowerName })
    .getOne();
}

const TYPE_MAP: Record<string, string> = {
  crm: "CRM",
  whatsapp: "WHATSAPP",
  whatsapp_business: "WHATSAPP",
  communication: "COMMUNICATION",
  sms: "SMS",
  email: "EMAIL",
  social: "SOCIAL",
  payment: "PAYMENT",
  custom: "CUSTOM",

  CRM: "CRM",
  WHATSAPP: "WHATSAPP",
  COMMUNICATION: "COMMUNICATION",
  SMS: "SMS",
  EMAIL: "EMAIL",
  SOCIAL: "SOCIAL",
  PAYMENT: "PAYMENT",
  CUSTOM: "CUSTOM",
};

// create Tenant
router.post(
  "/client",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};

      const {
        tenantName,
        username,
        companyName,
        domain,
        industry,
        region,
        contactPerson,
        email,
        contactPhone,
        status = "ACTIVE",
        mfaEnabled = false,
        slaTier = "BASIC",
        notes,
        regAddress,
        gstNo,
        registrationNo,
        panNo,
        logoUrl,
        isActive=false,
        licenseValidityStartDate,
        licenseValidityEndDate,
        billingDetail,
        licenses = [],
        integrations = [],
      } = body;

      // minimal required
      if (!tenantName || !username || !companyName || !email) {
        throw createError(400, "tenantName, username, companyName and email are required");
      }

      // uniqueness checks
      const existingClientByEmail = await ClientRepo().findOne({ where: { email } as any });
      if (existingClientByEmail) throw createError(409, "Client with this email already exists");
      const existingClientByUsername = await ClientRepo().findOne({ where: { username } as any });
      if (existingClientByUsername) throw createError(409, "Client username already exists");

      const tempPasswordPlain = `${String(username).slice(0, 4).toLowerCase()}2025`;
      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
      const tempPasswordHash = await bcrypt.hash(tempPasswordPlain, BCRYPT_ROUNDS);

      const result = await AppDataSource.manager.transaction(async (manager) => {
        // 1) create client
        const client = manager.create(
          Client,
          {
            tenantName,
            username,
            companyName,
            domain: domain || `${username}.example.com`,
            industry: industry || null,
            region: region || null,
            contactPerson: contactPerson || null,
            email,
            contactPhone: contactPhone || null,
            status,
            isActive,
            mfaEnabled,
            slaTier,
            notes: notes || null,
            regAddress: regAddress || null,
            gstNo: gstNo || null,
            registrationNo: registrationNo || null,
            panNo: panNo || null,
            logoUrl: logoUrl || null,
            passwordHash: tempPasswordHash,
            licenseValidityStartDate: licenseValidityStartDate ? new Date(licenseValidityStartDate) : new Date(),
            licenseValidityEndDate: licenseValidityEndDate ? new Date(licenseValidityEndDate) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
            createdById: (req.user as any)?.sub || null,
            createdByType: (req.user as any)?.typ || "superadmin",
          } as any
        );

        const savedClient = await manager.save(client);

        // 2) find global 'superuser' role and create system user for this client
        const roleSuperuser = await findRoleByNameCaseInsensitive("superuser", savedClient.id);
        if (!roleSuperuser) throw createError(500, "Platform role 'superuser' is not configured");

        const systemUser = manager.create(
          User,
          {
            Client: savedClient,
            email: email,
            passwordHash: tempPasswordHash,
            displayName: tenantName,
            mobile: contactPhone || null,
            role: roleSuperuser,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any
        );

        const savedSystemUser = await manager.save(systemUser);

        // 3) create billing detail if provided
        if (billingDetail && typeof billingDetail === "object") {
          const bill = manager.create(BillingDetail, {
            Client: savedClient,
            ClientId: savedClient.id,
            billingContactName: billingDetail.billingContactName || null,
            billingEmail: billingDetail.billingEmail || null,
            billingAddress: billingDetail.billingAddress || null,
            billingCycle: billingDetail.billingCycle || "MONTHLY",
            billingStartDate: billingDetail.billingStartDate || null,
            billingCurrency: billingDetail.billingCurrency || "INR",
            billingMethod: billingDetail.billingMethod || null,
            currentPlan: billingDetail.currentPlan || null,
            renewalDate: billingDetail.renewalDate || null,
            outstandingBalance: billingDetail.outstandingBalance || "0.00",
            lastPaymentDate: billingDetail.lastPaymentDate || null,
            paymentStatus: billingDetail.paymentStatus || "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
          await manager.save(bill);
        }

        // 4) process license allocations (LicenseTypeMaster -> LicenseAllocation)
        if (Array.isArray(licenses) && licenses.length > 0) {
          const licenseRepo = manager.getRepository(LicenseTypeMaster);
          const wantedCodes = Array.from(new Set(licenses.map((l: any) => String(l.roleName || "").toUpperCase()).filter(Boolean)));
          let masters: LicenseTypeMaster[] = [];
          if (wantedCodes.length > 0) {
            masters = await licenseRepo
              .createQueryBuilder("lt")
              .where("UPPER(lt.code) IN (:...codes)", { codes: wantedCodes })
              .getMany();
          }
          const masterByCode = new Map<string, LicenseTypeMaster>();
          for (const m of masters) masterByCode.set(String((m.code || "").toUpperCase()), m);

          const allocationRepo = manager.getRepository(LicenseAllocation);

          for (const lic of licenses) {
            const code = String((lic.roleName || "").toUpperCase());
            const licenseType = masterByCode.get(code);
            if (!licenseType) {
              throw createError(400, `LicenseTypeMaster not found for role code '${code}'`);
            }

            const allocatedCount = Math.max(0, Number(lic.allocatedCount || lic.maxUsers || 0));
            const channelsCount = Number(lic.channelsCount || 0);

            const alloc = manager.create(LicenseAllocation, {
              Client: savedClient,
              licenseType,
              allocatedCount,
              requestedCount: 0,
              usedCount: 0,
              createdAt: new Date(),
              lastUpdated: new Date(),
            } as any);

            await allocationRepo.save(alloc);
          }
        }

        // 5) process integrations (client_integrations + integration_secrets)
        const integrationRepo = manager.getRepository(ClientIntegration);
        const secretRepo = manager.getRepository(IntegrationSecret);

        const createdIntegrations: Array<{ id: string; provider: string; type: string; name?: string }> = [];

        // normalize input (accept array or object-of-integrations)
        const normalizedIntegrations = normalizeIntegrationsInput(integrations);

        for (const rawInteg of normalizedIntegrations) {
          const integ = rawInteg || {};
          // require provider and type
          if (!("type" in integ) || !integ.type || !integ.provider) {
            // skip invalid entries
            continue;
          }

          // normalize type to DB enum label
          const incomingRaw = String(integ.type).trim();
          const incomingLower = incomingRaw.toLowerCase();
          const incomingUpper = incomingRaw.toUpperCase();
          const enumValue = TYPE_MAP[incomingLower] || TYPE_MAP[incomingRaw] || TYPE_MAP[incomingUpper] || incomingUpper;

          const ci = manager.create(ClientIntegration, {
            client: savedClient,
            type: enumValue,
            provider: integ.provider,
            name: integ.name || null,
            isActive: typeof integ.isActive === "boolean" ? integ.isActive : true,
            config: integ.config || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          const savedIntegration = await integrationRepo.save(ci);

          // secrets: encrypt & save
          if (Array.isArray(integ.secrets) && integ.secrets.length > 0) {
            for (const s of integ.secrets) {
              if (!s.key || typeof s.value === "undefined" || s.value === null) continue;
              const { ciphertext, kmsKeyId } = await encryptSecret(String(s.value));
              const sec = manager.create(IntegrationSecret, {
                integration: savedIntegration,
                key: s.key,
                encryptedValue: ciphertext,
                kmsKeyId: kmsKeyId || null,
                meta: s.meta || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
              await secretRepo.save(sec);
            }
          }

          // optionally create webhooks if provided
          if (Array.isArray(integ.webhooks) && integ.webhooks.length > 0) {
            for (const wh of integ.webhooks) {
              await manager.getRepository("IntegrationWebhook").save({
                integration: savedIntegration,
                url: wh.url,
                active: typeof wh.active === "boolean" ? wh.active : true,
                meta: wh.meta || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
            }
          }

          createdIntegrations.push({
            id: savedIntegration.id,
            provider: savedIntegration.provider,
            type: savedIntegration.type,
            name: savedIntegration.name,
          });
        }

        return {
          client: savedClient,
          systemUser: savedSystemUser,
          integrations: createdIntegrations,
        };
      });

      // non-blocking: send welcome email to contactEmail containing system username (and send password separately if you want)
      try {
        await send2FACode({
          to: email,
          code: `Client ${result.client.tenantName || result.client.companyName} registered. System user created: ${result.systemUser.email}. Temporary password sent to admin separately.`,
        });
      } catch (e) {
        console.warn("Failed to send client welcome email", e);
      }

      return res.status(201).json({
        success: true,
        msg: "Client registered with billing, licenses and integrations (if provided)",
        clientId: result.client.id,
        systemUserId: result.systemUser.id,
        integrations: result.integrations,
      });
    } catch (err) {
      next(err);
    }
  }
);

//create user
router.post(
  "/user",
  requireAuth,
  allowRoles("superuser", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId: clientIdBody, email, role: roleName, mobile, displayName,username } = req.body || {};

      if (!email || !roleName) {
        throw createError(400, "email and role are required");
      }

      const actor = (req.user ?? {}) as any;
      console.log("actor from token:", actor);
      const effectiveClientId = actor.clientId || clientIdBody;
      if (!effectiveClientId) throw createError(400, "clientId missing (owner)");

      const client = await ClientRepo().findOne({ where: { id: effectiveClientId } as any });
      if (!client) throw createError(404, "Client not found");

      const roleRef = await findRoleByNameCaseInsensitive(roleName, client.id);
      if (!roleRef) {
        throw createError(400, `Role not found: ${roleName}`);
      }

      if (!roleRef.isGlobal && roleRef.client && (roleRef.client as any).id !== client.id) {
        throw createError(403, `Role ${roleRef.name} cannot be assigned to this client`);
      }

      const dup = await UserRepo().findOne({
        where: { Client: { id: client.id } as any, email: (email || "").toLowerCase() } as any,
      });
      if (dup) throw createError(409, "Email already used in this client");

      // let finalPassword = displayName;
      // if (!displayName) {
      //   const baseSource = (displayName || "").trim() || String(email).split("@")[0] || "user";
      //   const first4 = (baseSource.length >= 4 ? baseSource.slice(0, 4) : baseSource.padEnd(4, "x")).toLowerCase();
      //   finalPassword = `${first4}2025`;
      // } else {
      //   const usernameForPolicy = String((email || "").split("@")[0]);
      //   const pwCheck = validatePassword(displayName, { username: usernameForPolicy, name: displayName || usernameForPolicy });
      //   if (!pwCheck.ok) {
      //     const msg = pwCheck.reason ? `${pwCheck.reason}` : "Password policy violation";
      //     throw createError(400, `Password policy violation: ${msg}`);
      //   }
      // }

       const tempPasswordPlain = `${String(username).slice(0, 4).toLowerCase()}2025`;
      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
      const tempPasswordHash = await bcrypt.hash(tempPasswordPlain, BCRYPT_ROUNDS);

      const { createdUser } = await AppDataSource.manager.transaction(async (manager) => {
        const u = manager.create(User, {
          Client: client,
          email: (email || "").toLowerCase(),
          passwordHash: tempPasswordHash,
          mobile: mobile || null,
          displayName: displayName || null,
          role: roleRef,
          isActive: false,
          isTemporaryPassword: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);

        const savedUser = await manager.save(u);

        // --- LICENSE INCREMENT LOGIC ---
        const licenseTypeRepo = manager.getRepository(LicenseTypeMaster);
        const licenseAllocationRepo = manager.getRepository(LicenseAllocation);

        const wantedCode = String((roleRef.name || "").toUpperCase());
        const licenseType = await licenseTypeRepo
          .createQueryBuilder("lt")
          .where("UPPER(lt.code) = :code", { code: wantedCode })
          .getOne();

        if (!licenseType) {
          // rollback entire transaction if license type not configured
          throw createError(400, `License type not configured for role '${roleRef.name}' (expected code '${wantedCode}')`);
        }

        // find allocation for this client + licenseType
        const allocation = await licenseAllocationRepo.findOne({
          where: {
            Client: { id: client.id } as any,
            licenseType: { id: licenseType.id } as any,
          } as any,
        });

        if (!allocation) {
          throw createError(403, `No license allocation found for role '${roleRef.name}' for this client`);
        }

        const currentUsed = Number((allocation as any).usedCount || 0);
        const allocated = Number((allocation as any).allocatedCount || 0);
        const newUsed = currentUsed + 1;

        if (newUsed > allocated) {
          throw createError(403, `Cannot create user: allocated licenses exceeded for role '${roleRef.name}' (allocated=${allocated}, used=${currentUsed})`);
        }

        (allocation as any).usedCount = newUsed;
        (allocation as any).lastUpdated = new Date();

        await licenseAllocationRepo.save(allocation);
      
        return { createdUser: savedUser };
      });

      try {
        await send2FACode({
          to: email,
          code: `Welcome ${displayName || email}. Your account at ${client.username || client.id} has been created. Temporary password: ${finalPassword}. Please login and reset your password.`,
        });
      } catch (e) {
        console.warn("Failed to send user registration email:", e);
      }

      return res.status(201).json({
        success: true,
        msg: "User created",
        userId: (createdUser as any).id || null,
      });
    } catch (err) {
      next(err);
    }
  }
);


router.post(
  "/clients/basic",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};
      const {
        tenantName,
        username,
        companyName,
        domain,
        industry,
        region,
        contactPerson,
        email,
        contactPhone,
        status = "DEACTIVATED",
        mfaEnabled = false,
        slaTier = "BASIC",
        isActive =false,
        notes,
        regAddress,
        gstNo,
        registrationNo,
        panNo,
        logoUrl,
        licenseValidityStartDate,
        licenseValidityEndDate,
        licenses = [],
      } = body;

      if (!tenantName || !username || !companyName || !email) {
        throw createError(400, "tenantName, username, companyName and email are required");
      }

      const exists = await ClientRepo().findOne({ where: [{ email }, { username }] as any });
      if (exists) throw createError(409, "Client with this email/username already exists");

      // generate temporary password (you can choose another rule)
      const tempPasswordPlain = `${String(username).slice(0, 4).toLowerCase()}2025`;
      const tempHash = await bcrypt.hash(tempPasswordPlain, Number(process.env.BCRYPT_SALT_ROUNDS || 12));

      const result = await AppDataSource.manager.transaction(async (manager) => {
        // create client (inactive)
        const client = manager.create(Client, {
          tenantName,
          username,
          companyName,
          domain: domain || `${username}.example.com`,
          industry: industry || null,
          region: region || null,
          contactPerson: contactPerson || null,
          email,
          contactPhone: contactPhone || null,
          status,
          mfaEnabled,
          slaTier,
          isActive,
          notes: notes || null,
          regAddress: regAddress || null,
          gstNo: gstNo || null,
          registrationNo: registrationNo || null,
          panNo: panNo || null,
          logoUrl: logoUrl || null,
          passwordHash: tempHash, // optional, you had previously
          licenseValidityStartDate: licenseValidityStartDate ? new Date(licenseValidityStartDate) : new Date(),
          licenseValidityEndDate: licenseValidityEndDate ? new Date(licenseValidityEndDate) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
         
          isActive: false,
        } as any);

        const savedClient = await manager.save(client);

        // create system user (inactive)
        const roleSuperuser = await findRoleByNameCaseInsensitive("superuser", savedClient.id);
        if (!roleSuperuser) throw createError(500, "Platform role 'superuser' is not configured");

        const systemUser = manager.create(User, {
          Client: savedClient,
          email,
          passwordHash: tempHash,
          displayName: tenantName,
          mobile: contactPhone || null,
          role: roleSuperuser,
          isActive: SUSPEND,
          // don't include createdAt/updatedAt if your User entity doesn't have those
        } as any);

        const savedSystemUser = await manager.save(systemUser);

        // process license allocations if provided
        if (Array.isArray(licenses) && licenses.length > 0) {
          const licenseRepo = manager.getRepository(LicenseTypeMaster);
          const wantedCodes = Array.from(new Set(licenses.map((l: any) => String(l.roleName || "").toUpperCase()).filter(Boolean)));
          let masters: LicenseTypeMaster[] = [];
          if (wantedCodes.length > 0) {
            masters = await licenseRepo
              .createQueryBuilder("lt")
              .where("UPPER(lt.code) IN (:...codes)", { codes: wantedCodes })
              .getMany();
          }
          const masterByCode = new Map<string, LicenseTypeMaster>();
          for (const m of masters) masterByCode.set(String((m.code || "").toUpperCase()), m);

          const allocationRepo = manager.getRepository(LicenseAllocation);
          for (const lic of licenses) {
            const code = String((lic.roleName || "").toUpperCase());
            const licenseType = masterByCode.get(code);
            if (!licenseType) {
              throw createError(400, `LicenseTypeMaster not found for role code '${code}'`);
            }
            const allocatedCount = Math.max(0, Number(lic.allocatedCount || lic.maxUsers || 0));
            const alloc = allocationRepo.create({
              Client: savedClient,
              licenseType,
              allocatedCount,
              requestedCount: 0,
              usedCount: 0,
         
            } as any);
            await allocationRepo.save(alloc);
          }
        }

        return { client: savedClient, systemUser: savedSystemUser, tempPasswordPlain };
      });

      // optionally: send temp password via email/SMS here instead of returning it
      return res.status(201).json({
        success: true,
        msg: "Client created in INACTIVE state with system user",
        clientId: result.client.id,
        systemUserId: result.systemUser.id,
        temporaryPassword: result.tempPasswordPlain, // remove in prod if you don't want to return it
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/clients/:clientId/billing",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const body = req.body || {};

      const result = await AppDataSource.manager.transaction(async (manager) => {
        // find client
        const client = await manager.findOne(Client, { where: { id: clientId } as any });
        if (!client) throw createError(404, "Client not found");

        const billRepo = manager.getRepository(BillingDetail);

        // findOne returns either BillingDetail | null
        let billing = await billRepo.findOne({ where: { Client: { id: clientId } as any } });

        if (!billing) {
          // create new billing detail
          billing = billRepo.create({
            Client: client,
            ClientId: client.id,
            billingContactName: body.billingContactName ?? null,
            billingEmail: body.billingEmail ?? null,
            billingAddress: body.billingAddress ?? null,
            billingCycle: body.billingCycle ?? "MONTHLY",
            billingStartDate: body.billingStartDate ? new Date(body.billingStartDate) : null,
            billingCurrency: body.billingCurrency ?? "INR",
            billingMethod: body.billingMethod ?? null,
            currentPlan: body.currentPlan ?? null,
            renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
            outstandingBalance: typeof body.outstandingBalance !== "undefined" ? String(body.outstandingBalance) : "0.00",
            lastPaymentDate: body.lastPaymentDate ? new Date(body.lastPaymentDate) : null,
            paymentStatus: body.paymentStatus ?? "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
        } else {
          // update existing billing detail safely
          billing.billingContactName = body.billingContactName ?? billing.billingContactName;
          billing.billingEmail = body.billingEmail ?? billing.billingEmail;
          billing.billingAddress = body.billingAddress ?? billing.billingAddress;
          billing.billingCycle = body.billingCycle ?? billing.billingCycle;
          billing.billingStartDate = body.billingStartDate ? new Date(body.billingStartDate) : billing.billingStartDate;
          billing.billingCurrency = body.billingCurrency ?? billing.billingCurrency;
          billing.billingMethod = body.billingMethod ?? billing.billingMethod;
          billing.currentPlan = body.currentPlan ?? billing.currentPlan;
          billing.renewalDate = body.renewalDate ? new Date(body.renewalDate) : billing.renewalDate;
          billing.outstandingBalance = typeof body.outstandingBalance !== "undefined" ? String(body.outstandingBalance) : billing.outstandingBalance;
          billing.lastPaymentDate = body.lastPaymentDate ? new Date(body.lastPaymentDate) : billing.lastPaymentDate;
          billing.paymentStatus = body.paymentStatus ?? billing.paymentStatus;
          billing.updatedAt = new Date();
        }

        const savedBilling = await billRepo.save(billing);

        // update client's draftUpdatedAt (if client supports that field)
        if ("draftUpdatedAt" in client) {
          (client as any).draftUpdatedAt = new Date();
          await manager.save(client);
        }

        return savedBilling;
      });

      return res.json({ success: true, billing: result });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/clients/:clientId/integrations",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const rawInput = req.body?.integrations ?? req.body;
      const normalized = normalizeIntegrationsInput(rawInput);

      const savedRows = await AppDataSource.manager.transaction(async (manager) => {
        const client = await manager.findOne(Client, { where: { id: clientId } as any });
        if (!client) throw createError(404, "Client not found");

        const integrationRepo = manager.getRepository(ClientIntegration);
        const secretRepo = manager.getRepository(IntegrationSecret);

        // delete existing integrations + secrets for simplicity (replace strategy)
        const existing = await integrationRepo.find({ where: { client: { id: clientId } as any } });
        if (existing.length > 0) {
          const ids = existing.map((x: any) => x.id);
          // try delete secrets by integration ids (adjust FK name if different)
          await secretRepo.createQueryBuilder().delete().where("integration_id IN (:...ids)", { ids }).execute();
          await integrationRepo.createQueryBuilder().delete().where("client_id = :cid", { cid: clientId }).execute();
        }

        const out: any[] = [];
        for (const rawInteg of normalized) {
          if (!rawInteg.type || !rawInteg.provider) continue;

          const incomingRaw = String(rawInteg.type).trim();
          const enumVal = TYPE_MAP[incomingRaw.toLowerCase()] || incomingRaw.toUpperCase();

          const row = integrationRepo.create({
            client,
            type: enumVal,
            provider: rawInteg.provider,
            name: rawInteg.name || null,
            isActive: typeof rawInteg.isActive === "boolean" ? rawInteg.isActive : true,
            config: rawInteg.config || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);

          const saved = await integrationRepo.save(row);

          if (Array.isArray(rawInteg.secrets) && rawInteg.secrets.length > 0) {
            for (const s of rawInteg.secrets) {
              if (!s.key || typeof s.value === "undefined" || s.value === null) continue;
              const { ciphertext, kmsKeyId } = await encryptSecret(String(s.value));
              const secretRow = secretRepo.create({
                integration: saved,
                key: s.key,
                encryptedValue: ciphertext,
                kmsKeyId: kmsKeyId || null,
                meta: s.meta || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
              await secretRepo.save(secretRow);
            }
          }

          // webhooks if present
          if (Array.isArray(rawInteg.webhooks) && rawInteg.webhooks.length > 0) {
            for (const wh of rawInteg.webhooks) {
              await manager.getRepository("IntegrationWebhook").save({
                integration: saved,
                url: wh.url,
                active: typeof wh.active === "boolean" ? wh.active : true,
                meta: wh.meta || null,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any);
            }
          }

          out.push({ id: saved.id, type: saved.type, provider: saved.provider, name: saved.name });
        }

        // update client's draftUpdatedAt if exists
        if ("draftUpdatedAt" in client) {
          (client as any).draftUpdatedAt = new Date();
          await manager.save(client);
        }

        return out;
      });

      return res.json({ success: true, integrations: savedRows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /clients/:clientId/finalize

// POST /clients/:clientId/finalize
router.post(
  "/clients/:clientId/finalize",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;

      const result = await AppDataSource.manager.transaction(async (manager) => {
        // 1) load client (adjust `id` -> `clientId` if your PK is named clientId)
        const client = await manager.findOne(Client, { where: { id: clientId } as any });
        if (!client) throw createError(404, "Client not found");

        // 2) guard: already active?
        if (client.status === "ACTIVE") {
          throw createError(400, "Client is already active");
        }

        // 3) optional basic validation
        if (!client.tenantName || !client.username || !client.companyName || !client.email) {
          throw createError(400, "Client basic details incomplete; cannot finalize");
        }

        // 4) activate client
        client.status = "ACTIVE";
        if ("activatedAt" in client) (client as any).activatedAt = new Date();
        if ("updatedAt" in client) (client as any).updatedAt = new Date();
        const savedClient = await manager.save(client);

        // 5) Activate users who have role name 'superuser' (case-insensitive) for this client.
        const userRepo = manager.getRepository(User);

        // Use query builder to join Role by name (no reliance on role.id PK name).
        // Note: adjust the relation names ('role', 'Client') if your User entity uses different property names.
        const superuserRows = await userRepo
          .createQueryBuilder("user")
          .leftJoinAndSelect("user.role", "role")
          .leftJoinAndSelect("user.Client", "client")
          .where("client.id = :clientId", { clientId: savedClient.id })
          .andWhere("LOWER(role.name) = :rname", { rname: "superuser" })
          .getMany();

        const activatedUserIds: string[] = [];
        for (const u of superuserRows) {
          if ((u as any).isActive !== true) {
            (u as any).isActive = true;
            if ("activatedAt" in u) (u as any).activatedAt = new Date();
            if ("updatedAt" in u) (u as any).updatedAt = new Date();
            const savedU = await userRepo.save(u);
            activatedUserIds.push(savedU.id ?? (savedU as any).userId ?? String(savedU)); // best-effort id
          } else {
            activatedUserIds.push((u as any).id ?? (u as any).userId ?? String((u as any)));
          }
        }

        return { client: savedClient, activatedUserIds };
      });

      return res.status(200).json({
        success: true,
        msg: "Client activated and superuser(s) activated (if present)",
        clientId: result.client.id,
        activatedUserIds: result.activatedUserIds,
      });
    } catch (err) {
      next(err);
    }
  }
);


// GET /clients/:clientId  (detailed review view) - uses actual relation names from your Client entity
router.get(
  "/clients/:clientId",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;

      // load client with correct relations (match names in entities)
      const client = await AppDataSource.manager.getRepository(Client).findOne({
        where: { id: clientId } as any,
        relations: [
          "billingDetails",      // <- plural as per your entity
          "integrations",
          "licenseAllocations",
          "users"
        ],
      });

      if (!client) throw createError(404, "Client not found");

      // prepare integration summaries (no secrets)
      const integrations = (client.integrations || []) as any[];
      const integIds = integrations.map(i => i.id);
      const secretCountsRaw = integIds.length > 0 ? await AppDataSource.manager.getRepository(IntegrationSecret)
        .createQueryBuilder("s")
        .select("s.integrationId", "integrationId")
        .addSelect("COUNT(*)", "cnt")
        .where("s.integrationId IN (:...ids)", { ids: integIds })
        .groupBy("s.integrationId")
        .getRawMany() : [];

      const secretCountMap = new Map<string, number>();
      for (const r of secretCountsRaw) secretCountMap.set(String(r.integrationId), Number(r.cnt));

      const integrationsSummary = integrations.map((i: any) => ({
        id: i.id,
        type: i.type,
        provider: i.provider,
        name: i.name,
        isActive: i.isActive,
        config: i.config,
        hasSecrets: (secretCountMap.get(String(i.id)) || 0) > 0
      }));

      // billing: since relation is array, pick the latest or return array
      const billingArr = (client.billingDetails || []) as any[];
      // choose to return the most-recent billing (or entire array) — here I return the first if exists
      const billing = billingArr.length > 0 ? billingArr[0] : null;

      // licenses summary
      const licenseAllocations = (client.licenseAllocations || []) as any[];
      const licensesSummary = licenseAllocations.map((la: any) => ({
        id: la.id,
        licenseTypeCode: la.licenseType?.code || null,
        allocatedCount: la.allocatedCount,
        usedCount: la.usedCount,
      }));

      // users summary
      const users = (client.users || []) as any[];
      const usersSummary = users.map((u: any) => ({
        id: u.id ?? (u as any).userId,
        email: u.email,
        displayName: u.displayName,
        mobile: u.mobile,
        role: u.role?.name || null,
        isActive: u.isActive
      }));

      return res.json({
        success: true,
        client: {
          id: client.id,
          tenantName: client.tenantName,
          username: client.username,
          companyName: client.companyName,
          domain: client.domain,
          industry: client.industry,
          region: client.region,
          contactPerson: client.contactPerson,
          email: client.email,
          contactPhone: client.contactPhone,
          status: client.status,
          notes: client.notes,
          regAddress: client.regAddress,
          gstNo: client.gstNo,
          registrationNo: client.registrationNo,
          panNo: client.panNo,
          logoUrl: client.logoUrl,
          licenseValidityStartDate: client.licenseValidityStartDate,
          licenseValidityEndDate: client.licenseValidityEndDate,
          billing,
          integrations: integrationsSummary,
          licenses: licensesSummary,
          users: usersSummary
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /clients  (list) with pagination & summaries — robust join-based implementation
router.get(
  "/clients",
  requireAuth,
  allowRoles("superadmin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;
      const q = (req.query.q as string | undefined) || undefined;

      const repo = AppDataSource.getRepository(Client);
      const qb = repo.createQueryBuilder("client")
        .select([
          "client.id",
          "client.tenantName",
          "client.companyName",
          "client.username",
          "client.email",
          "client.contactPhone",
          "client.status",
          "client.region",
          "client.createdAt"
        ])
        .orderBy("client.createdAt", "DESC")
        .skip(offset)
        .take(limit);

      if (status) qb.andWhere("client.status = :status", { status });
      if (q) qb.andWhere(
        "(LOWER(client.tenantName) LIKE :q OR LOWER(client.companyName) LIKE :q OR LOWER(client.email) LIKE :q)",
        { q: `%${q.toLowerCase()}%` }
      );

      const [clients, total] = await qb.getManyAndCount();
      const clientIds = clients.map(c => (c as any).id);

      if (clientIds.length === 0) {
        return res.json({ success: true, page, limit, total, items: [] });
      }

      // 1) billing rows for these clients (billingDetails relation is plural in your entity)
      const billingRows = await AppDataSource.manager.getRepository(BillingDetail)
        .createQueryBuilder("b")
        .leftJoin("b.Client", "client")
        .where("client.id IN (:...ids)", { ids: clientIds })
        .getMany();

      // 2) integrations for these clients (join i.client -> c)
      const integrations = await AppDataSource.manager.getRepository(ClientIntegration)
        .createQueryBuilder("i")
        .leftJoin("i.client", "c")
        .where("c.id IN (:...ids)", { ids: clientIds })
        .getMany();

      // 3) secret counts per integration — use join on s.integration -> i (safe)
      const secretCountsMap = new Map<string, number>();
      if (integrations.length > 0) {
        const integIds = integrations.map((i: any) => i.id);
        const secretCounts = await AppDataSource.manager.getRepository(IntegrationSecret)
          .createQueryBuilder("s")
          .leftJoin("s.integration", "i")
          .select("i.id", "integrationId")
          .addSelect("COUNT(*)", "cnt")
          .where("i.id IN (:...ids)", { ids: integIds })
          .groupBy("i.id")
          .getRawMany();

        for (const r of secretCounts) secretCountsMap.set(String(r.integrationId), Number(r.cnt));
      }

      // 4) group billing by client id (take first if multiple)
      const billingByClient = new Map<string, any>();
      for (const b of billingRows) {
        const cid = String((b as any).ClientId ?? (b as any).Client?.id);
        if (!billingByClient.has(cid)) billingByClient.set(cid, b);
      }

      // 5) group integrations by client id
      const integrationsByClient = new Map<string, any[]>();
      for (const i of integrations) {
        const cid = String((i as any).client?.id ?? (i as any).client_id ?? (i as any).clientId ?? "");
        const arr = integrationsByClient.get(cid) || [];
        arr.push({
          id: i.id,
          type: i.type,
          provider: i.provider,
          name: i.name,
          config: i.config,
          hasSecrets: (secretCountsMap.get(String(i.id)) || 0) > 0
        });
        integrationsByClient.set(cid, arr);
      }

      // 6) assemble final items
      const items = clients.map((c: any) => ({
        id: c.id,
        tenantName: c.tenantName,
        companyName: c.companyName,
        username: c.username,
        email: c.email,
        contactPhone: c.contactPhone,
        status: c.status,
        isActive: c.isActive,
        region: c.region,
        createdAt: c.createdAt,
        billing: billingByClient.get(String(c.id)) || null,
        integrations: integrationsByClient.get(String(c.id)) || []
      }));

      return res.json({
        success: true,
        page,
        limit,
        total,
        items
      });
    } catch (err) {
      next(err);
    }
  }
);



export default router;
