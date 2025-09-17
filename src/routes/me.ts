// src/routes/me.ts
import express, { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../dataSource/data-source";
import { requireAuth } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";
import { User } from "../entities/User";
import { Client } from "../entities/Client";

const router = express.Router();

const UserRepo = () => AppDataSource.getRepository(User);
const ClientRepo = () => AppDataSource.getRepository(Client);

// helper to strip sensitive fields
function sanitizeUser(user: any) {
  if (!user) return user;
  const clone = { ...user };
  delete clone.passwordHash;
  return clone;
}

function sanitizeUsers(users: any[]) {
  return users.map((u) => sanitizeUser(u));
}

router.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = (req.user || {}) as any;
      const role = String((actor.role || "")).toLowerCase();
      const actorId = actor.sub;
      const actorClientId =
        actor.clientId || actor.ClientId || actor.tenantId || null;

      if (!actorId) return next(createError(401, "Not authenticated"));

      if (role === "superadmin") {
        const self = await UserRepo()
          .createQueryBuilder("u")
          .leftJoinAndSelect("u.role", "r")
          .where("u.id = :uid", { uid: actorId })
          .getOne();

        const clients = await ClientRepo()
          .createQueryBuilder("c")
          .leftJoinAndSelect("c.users", "cu")
          .leftJoinAndSelect("c.licenseAllocations", "la")
          .where("c.createdById = :creator", { creator: actorId })
          .orderBy("c.createdAt", "DESC")
          .getMany();

        // strip password from client.users
        const safeClients = clients.map((c) => ({
          ...c,
          users: sanitizeUsers(c.users || []),
        }));

        return res.json({
          success: true,
          role: "superadmin",
          user: sanitizeUser(self),
          clients: safeClients,
        });
      }

      // 2) SUPERUSER / ADMIN → all users from same client
      if (role === "superuser" || role === "admin") {
        if (!actorClientId)
          return next(createError(400, "Client scope missing in token"));

        const users = await UserRepo()
          .createQueryBuilder("u")
          .leftJoinAndSelect("u.role", "r")
          .leftJoinAndSelect("u.Client", "c")
          .where("c.id = :cid", { cid: actorClientId })
          .orderBy("u.createdAt", "DESC")
          .getMany();

        return res.json({
          success: true,
          role,
          clientId: actorClientId,
          users: sanitizeUsers(users),
        });
      }

      // 3) OTHER USERS → only self
      const self = await UserRepo()
        .createQueryBuilder("u")
        .leftJoinAndSelect("u.role", "r")
        .leftJoinAndSelect("u.Client", "c")
        .where("u.id = :uid", { uid: actorId })
        .getOne();

      if (!self) return next(createError(404, "User not found"));

      return res.json({
        success: true,
        role,
        user: sanitizeUser(self),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
