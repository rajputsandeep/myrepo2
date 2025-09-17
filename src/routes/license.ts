import express from "express";
import { AppDataSource } from "../dataSource/data-source";
import { requireAuth } from "../middleware/auth";
import { allowRoles } from "../middleware/roleGuard";
import { TenantLicense } from "../entities/TenantLicense";
import { TenantAccount } from "../entities/TenantAccount";
import { createError } from "../middleware/errorHandler";
import { Role } from "../entities/Role";

const router = express.Router();
const LicenseRepo = () => AppDataSource.getRepository(TenantLicense);
const TenantRepo = () => AppDataSource.getRepository(TenantAccount);
const RoleRepo = () => AppDataSource.getRepository(Role);


/**
 * GET /licenses/:tenantId
 * 🔹 SuperAdmin → View all licenses of a tenant
 * Always include all roles, missing ones return default (0)
 */
router.get(
  "/:tenantId",
  requireAuth,
  allowRoles("superadmin"),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;

      const tenant = await TenantRepo().findOne({ where: { id: tenantId } });
      if (!tenant) throw createError(404, "Tenant not found");

      // Get all roles except superadmin & superuser
      const roles = await RoleRepo().find();
      const assignableRoles = roles.filter(
        (r) => !["superadmin", "superuser"].includes(r.name.toLowerCase())
      );

      // Get existing licenses for this tenant
      const licenses = await LicenseRepo().find({
        where: { tenant: { id: tenantId } },
      });

      // Map licenses by role for quick lookup
      const licenseMap: Record<string, TenantLicense> = {};
      for (const l of licenses) {
        licenseMap[l.role.toLowerCase()] = l;
      }

      // Merge roles with licenses
      const allLicenses = assignableRoles.map((r) => {
        const lic = licenseMap[r.name.toLowerCase()];
        return lic
          ? {
              id: lic.id,
              role: lic.role,
              maxUsers: lic.maxUsers,
              usedUsers: lic.usedUsers,
              active: lic.active,
            }
          : {
              id: null,
              role: r.name,
              maxUsers: 0,
              usedUsers: 0,
              active: false,
            };
      });

      res.json({ success: true, licenses: allLicenses });
    } catch (err) {
      next(err);
    }
  }
);


router.put(
  "/:tenantId",
  requireAuth,
  allowRoles("superadmin"),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { licenses } = req.body;

      if (!Array.isArray(licenses)) {
        throw createError(400, "licenses must be an array of { role, maxUsers, active? }");
      }

      const tenant = await TenantRepo().findOne({ where: { id: tenantId } });
      if (!tenant) throw createError(404, "Tenant not found");

      const updated: any[] = [];

      for (const lic of licenses) {
        const roleNorm = String(lic.role).toLowerCase();
        const maxUsers = Number(lic.maxUsers);
        const active = lic.active !== undefined ? Boolean(lic.active) : true;

        if (isNaN(maxUsers)) {
          throw createError(400, `Invalid maxUsers for role: ${lic.role}`);
        }

        let license = await LicenseRepo().findOne({
          where: { tenant: { id: tenantId }, role: roleNorm },
        });

        if (license) {
          license.maxUsers = maxUsers;
          license.active = active;
          await LicenseRepo().save(license);
        } else {
          license = LicenseRepo().create({
            tenant,
            role: roleNorm,
            maxUsers,
            usedUsers: 0,
            active,
          });
          await LicenseRepo().save(license);
        }

        updated.push({
          id: license.id,
          role: license.role,
          maxUsers: license.maxUsers,
          usedUsers: license.usedUsers,
          active: license.active,
        });
      }

      res.json({ success: true, msg: "Licenses updated", licenses: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
