// src/routes/admin.ts
import express, { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../dataSource/data-source";
import { User } from "../entities/User";
import { requireAuth } from "../middleware/auth";
import { allowRoles } from "../middleware/roleGuard";
import { createError } from "../middleware/errorHandler";
import { Client } from "../entities/Client";
import { UserMfa } from "../entities/UserMfa";
import { ClientMfaPolicy } from "../entities/ClientMfaPolicy";
import { ClientRoleMfa } from "../entities/ClientRoleMfa";

const router = express.Router();
const userRepo = () => AppDataSource.getRepository(User);

// Reactivate a blocked user
router.post(
  "/users/:id/reactivate",
  requireAuth,
  allowRoles("superuser", "admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      const user = await userRepo().findOne({ where: { id } as any });

      if (!user) throw createError(404, "User not found");

      if (user.status !== "DEACTIVATED") {
        return res.json({
          success: false,
          message: "User is not blocked",
        });
      }

      user.status = "ACTIVE";
      await userRepo().save(user);

      return res.json({
        success: true,
        message: "User has been reactivated successfully",
        userId: user.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// // handler (inside admin router)
// router.put("/admin/clients/:clientId/mfa", requireAuth, allowRoles("superadmin"), async (req, res, next) => {
//   try {
//     const { clientId } = req.params;
//     const { mfaEnabled } = req.body;
//     if (typeof mfaEnabled !== "boolean") throw createError(400, "mfaEnabled boolean required");

//     const repo = AppDataSource.getRepository(Client);
//     const client = await repo.findOne({ where: { id: clientId } as any });
//     if (!client) throw createError(404, "Client not found");

//     client.mfaEnabled = mfaEnabled;
//     await repo.save(client);

//     return res.json({ success: true, clientId, mfaEnabled });
//   } catch (err) {
//     next(err);
//   }
// });

// router.put("/clients/:clientId/users/:userId/mfa", requireAuth, allowRoles("superuser","admin"), async (req, res, next) => {
//   try {
//     const actor = req.user as any;
//     const { clientId, userId } = req.params;
//     if (actor.clientId !== clientId) throw createError(403, "Not allowed for this client");

//     const { enabled } = req.body;
//     if (typeof enabled !== "boolean") throw createError(400, "enabled boolean required");

//     const UserMfaRepo = AppDataSource.getRepository(UserMfa);
//     // find existing row (email method preferred)
//     let row = await UserMfaRepo.findOne({ where: { userId, mfaType: "email" } as any });
//     if (!row) {
//       row = UserMfaRepo.create({ userId, mfaType: "email", enabled });
//     } else {
//       row.enabled = enabled;
//     }
//     await UserMfaRepo.save(row);

//     return res.json({ success: true, userId, enabled });
//   } catch (err) {
//     next(err);
//   }
// });

// router.put("/clients/:clientId/mfa/policy", requireAuth, allowRoles("superuser","admin"), async (req, res, next) => {
//   try {
//     const actor = req.user as any;
//     const { clientId } = req.params;
//     if (actor.clientId !== clientId) throw createError(403, "Not allowed for this client");

//     const { roleName, mfaRequired } = req.body;
//     if (!roleName || typeof mfaRequired !== "boolean") throw createError(400, "roleName and mfaRequired required");

//     const repo = AppDataSource.getRepository(ClientMfaPolicy);
//     let row = await repo.createQueryBuilder("p")
//       .where("p.client_id = :cid", { cid: clientId })
//       .andWhere("LOWER(p.role_name) = LOWER(:role)", { role: roleName })
//       .getOne();

//     if (!row) {
//       row = repo.create({ client: { id: clientId } as any, clientId, roleName, mfaRequired });
//     } else {
//       row.mfaRequired = mfaRequired;
//     }
//     await repo.save(row);

//     return res.json({ success: true, clientId, roleName, mfaRequired });
//   } catch (err) {
//     next(err);
//   }
// });

// PUT /clients/:clientId/mfa/roles
// body: { roleId: "uuid", mfaRequired: true }
router.put(
  "/clients/:clientId/mfa/roles",
  requireAuth,
  allowRoles("superadmin", "superuser", "admin"), // ensure only client-admins or superuser call it
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = req.user as any;
      const { clientId } = req.params;
      if (!clientId) throw createError(400, "clientId required in path");

      // only allow actor of that client (unless superadmin)
      if (actor.role !== "superadmin" && actor.clientId !== clientId) {
        throw createError(403, "Not allowed for this client");
      }

      const { roleId, mfaRequired } = req.body || {};
      if (!roleId || typeof mfaRequired !== "boolean") throw createError(400, "roleId and mfaRequired required");

      const repo = AppDataSource.getRepository(ClientRoleMfa);
      let row = await repo.findOne({ where: { clientId, roleId } as any });
      if (!row) {
        row = repo.create({ client: { id: clientId } as any, clientId, role: { roleId } as any, roleId, mfaRequired });
      } else {
        row.mfaRequired = mfaRequired;
      }
      await repo.save(row);

      return res.json({ success: true, clientId, roleId, mfaRequired });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
