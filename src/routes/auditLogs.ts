// src/routes/audit.ts
import express from "express";
import { requireAuth } from "../middleware/auth";
import { allowRoles } from "../middleware/roleGuard";
import { AppDataSource } from "../dataSource/data-source";
import { AuditLog } from "../entities/AuditLogs";

const router = express.Router();

// GET /audit-logs?clientId=...&actorId=...&action=...
router.get(
  "/audit-logs",
  requireAuth,
  allowRoles("superadmin"),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const repo = AppDataSource.getRepository(AuditLog);
      const qb = repo.createQueryBuilder("log")
        .leftJoinAndSelect("log.client", "client")
        .orderBy("log.createdAt", "DESC")
        .skip(offset)
        .take(limit);

      if (req.query.clientId) qb.andWhere("client.id = :clientId", { clientId: req.query.clientId });
      if (req.query.actorId) qb.andWhere("log.actorId = :actorId", { actorId: req.query.actorId });
      if (req.query.action) qb.andWhere("log.action = :action", { action: req.query.action });

      const [logs, total] = await qb.getManyAndCount();

      return res.json({
        success: true,
        page,
        limit,
        total,
        items: logs,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
