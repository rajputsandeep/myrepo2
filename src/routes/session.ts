// src/routes/sessions.ts
import express, { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../dataSource/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { requireAuth } from "../middleware/auth";
import { allowRoles } from "../middleware/roleGuard";
import { createError } from "../middleware/errorHandler";

const router = express.Router();

// helper to map RefreshToken -> safe DTO
function sessionDto(row: RefreshToken) {
  return {
    tokenId: (row as any).tokenId,
    userType: (row as any).userType,
    email: (row as any).email,
    clientId: (row as any).client ? (row as any).client.id : null,
    createdAt: (row as any).createdAt,
    expiresAt: (row as any).expiresAt,
    revoked: (row as any).revoked,
    replacedByTokenId: (row as any).replacedByTokenId ?? null,
  };
}

/**
 * GET /sessions
 * - Authenticated user: list their sessions (active + history)
 * - Query params: limit (default 25), offset (default 0)
 */
router.get("/sessions", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user!;
    const userId = actor.sub;
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const offset = Number(req.query.offset || 0);

    const repo = AppDataSource.getRepository(RefreshToken);
    const [rows, total] = await repo.findAndCount({
      where: { userId } as any,
      relations: ["client"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    return res.json({
      success: true,
      total,
      limit,
      offset,
      sessions: rows.map(sessionDto),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users/:userId/sessions
 * - Admins / Superadmins only: view sessions for any user
 */
router.get("/admin/users/:userId/sessions", requireAuth, allowRoles("superadmin", "admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw createError(400, "userId required");

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Number(req.query.offset || 0);

    const repo = AppDataSource.getRepository(RefreshToken);
    const [rows, total] = await repo.findAndCount({
      where: { userId } as any,
      relations: ["client"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    return res.json({
      success: true,
      total,
      limit,
      offset,
      sessions: rows.map(sessionDto),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /sessions/:tokenId
 * - self: revoke one of your sessions (e.g. remote device)
 * - admin: can revoke any user's session
 */
router.delete("/sessions/:tokenId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user!;
    const tokenId = req.params.tokenId;
    if (!tokenId) throw createError(400, "tokenId required");

    const repo = AppDataSource.getRepository(RefreshToken);
    const row = await repo.findOne({ where: { tokenId } as any, relations: ["client"] });

    if (!row) return res.status(404).json({ success: false, message: "Session not found" });

    // allow if actor is admin/superadmin
    const isAdmin = ["admin", "superadmin"].includes((actor.role || "").toLowerCase());

    if (!isAdmin && row.userId !== actor.sub) {
      throw createError(403, "Not allowed to revoke this session");
    }

    await repo.createQueryBuilder()
      .update()
      .set({ revoked: true })
      .where("token_id = :tid", { tid: tokenId })
      .execute();

    return res.json({ success: true, message: "Session revoked", tokenId });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /sessions
 * - Revoke all other sessions for the current user (keep current one if present)
 * - Query param `keep` (tokenId) optional: if provided, that token is kept; else all revoked
 */
router.delete("/sessions", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user!;
    const userId = actor.sub;
    const keepTokenId = req.query.keep as string | undefined;

    const repo = AppDataSource.getRepository(RefreshToken);

    if (keepTokenId) {
      // revoke all sessions for user except keepTokenId
      await repo.createQueryBuilder()
        .update()
        .set({ revoked: true })
        .where("user_id = :uid AND token_id != :keep", { uid: userId, keep: keepTokenId })
        .andWhere("revoked = false")
        .execute();
    } else {
      // revoke all sessions for user
      await repo.createQueryBuilder()
        .update()
        .set({ revoked: true })
        .where("user_id = :uid", { uid: userId })
        .andWhere("revoked = false")
        .execute();
    }

    return res.json({ success: true, message: "Sessions revoked" });
  } catch (err) {
    next(err);
  }
});

export default router;
