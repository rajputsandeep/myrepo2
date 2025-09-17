// src/services/session.service.ts
import crypto from "crypto";
import { createHash } from "crypto";
import { AppDataSource } from "../dataSource/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { Client } from "../entities/Client";

// Optional Redis import — only used if USE_REDIS === "true"
let redis: any = null;
const USE_REDIS = String(process.env.USE_REDIS || "false").toLowerCase() === "true";
if (USE_REDIS) {
  try {
    // lazy import so app can start without redis installed/configured
    // expects src/lib/redis.ts to export `redis` (an ioredis instance)
    // or adjust path to your redis client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    redis = require("../lib/redis").redis;
  } catch (e) {
    // If Redis is enabled in env but import fails, log and fall back to DB-only
    console.warn("Redis requested but could not be loaded; falling back to DB-only:", e);
    redis = null;
  }
}

/** Typed return shapes */
import type { RefreshToken as RefreshTokenEntity } from "../entities/RefreshToken";

type IssuedSession = {
  raw: string; // raw token to send to client (keep secret)
  saved: RefreshTokenEntity;
};

type RotatedSession = {
  newRaw: string;
  savedNew: RefreshTokenEntity;
};

/* Configuration */
const REFRESH_BYTES = 48;
const REFRESH_HASH_ALGO = "sha256";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;

/* Helpers */
function hashToken(raw: string) {
  return createHash(REFRESH_HASH_ALGO).update(raw).digest("hex");
}
function redisSessionKey(tokenId: string) {
  return `session:${tokenId}`;
}
function redisUserSetKey(userId: string) {
  return `user_sessions:${userId}`;
}

/**
 * Issue refresh token (DB + optional Redis). Enforces single-session per user by revoking previous tokens.
 */
export async function issueRefreshToken({
  userId,
  email,
  clientId,
  userType = "user",
  ipAddr,
  userAgent,
}: {
  userId: string;
  email: string;
  clientId?: string | null;
  userType?: string;
  ipAddr?: string | null;
  userAgent?: string | null;
}): Promise<IssuedSession> {
  const RefreshRepo = AppDataSource.getRepository(RefreshToken);

  const raw = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  // 1) Transaction: revoke older DB tokens and insert new
  const saved = await AppDataSource.manager.transaction(async (manager) => {
    // revoke existing active tokens for this user (single-session)
    await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revoked: true })
      .where("user_id = :uid AND revoked = false", { uid: userId })
      .execute();

    const clientEntity = clientId ? ({ id: clientId } as Client) : null;

    const row = manager.create(RefreshToken, {
      userType,
      userId,
      email,
      client: clientEntity,
      tokenHash,
      revoked: false,
      expiresAt,
      // optionally: userAgent, ipAddr if entity supports them
      // userAgent,
      // ipAddr,
    } as any);

    const savedRow = await manager.save(row);
    return savedRow as RefreshTokenEntity;
  });

  // 2) Optional Redis: store session for fast validation
  if (USE_REDIS && redis) {
    try {
      const key = redisSessionKey((saved as any).tokenId);
      const value = JSON.stringify({
        tokenHash,
        userId,
        userType,
        clientId: clientId ?? null,
        expiresAt: expiresAt.toISOString(),
      });
      const userSetKey = redisUserSetKey(userId);
      const tx = redis.multi();
      tx.set(key, value, "EX", REFRESH_TTL_SECONDS);
      tx.sadd(userSetKey, (saved as any).tokenId);
      tx.expire(userSetKey, REFRESH_TTL_SECONDS);
      await tx.exec();
    } catch (e) {
      // Non-fatal: DB is authoritative, log Redis errors
      console.warn("Redis write failed in issueRefreshToken (continuing with DB-only):", e);
    }
  }

  return { raw, saved };
}

/**
 * Rotate refresh token: validate provided raw token, check Redis optionally, create new token and rotate storage.
 */
export async function rotateRefreshToken(raw: string): Promise<RotatedSession> {
  if (!raw) throw new Error("Missing refresh token");

  const RefreshRepo = AppDataSource.getRepository(RefreshToken);
  const hash = hashToken(raw);

  const row = await RefreshRepo.findOne({ where: { tokenHash: hash } as any, relations: ["client"] });
  if (!row) {
    throw new Error("Invalid refresh token");
  }
  if (row.revoked) {
    throw new Error("Refresh token revoked");
  }
  if (row.expiresAt && row.expiresAt <= new Date()) {
    throw new Error("Refresh token expired");
  }

  // Optional Redis verification to detect reuse
  if (USE_REDIS && redis) {
    try {
      const key = redisSessionKey((row as any).tokenId);
      const sessRaw = await redis.get(key);
      if (!sessRaw) {
        // treat missing Redis session as invalidated for safety
        throw new Error("Session not found (possibly revoked)");
      }
      const sess = JSON.parse(sessRaw);
      if (sess.tokenHash !== hash) {
        // token reuse detected: revoke all sessions for user
        await revokeAllSessionsForUser(row.userId);
        throw new Error("Token reuse detected; all sessions revoked");
      }
    } catch (e) {
      // If Redis errors, we choose to treat as fatal for strictness OR you can fallback to DB-only.
      // For now we rethrow to force caller to handle (rotate should fail)
      // If you prefer resilience, comment out the `throw e;` below.
      // throw e;
      console.warn("Redis check failed during rotateRefreshToken; proceeding with DB fallback:", e);
    }
  }

  // Create new token row and revoke old row atomically
  const newRaw = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  const newHash = hashToken(newRaw);
  const newExpiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

  const savedNew = await AppDataSource.manager.transaction(async (manager) => {
    // revoke old row
    row.revoked = true;
    await manager.save(row);

    // create new row
    const newRow = manager.create(RefreshToken, {
      userType: row.userType,
      userId: row.userId,
      email: row.email,
      client: row.client ?? null,
      tokenHash: newHash,
      revoked: false,
      expiresAt: newExpiresAt,
    } as any);

    const s = await manager.save(newRow);

    // optional backlink for auditing
    row.replacedByTokenId = (s as any).tokenId;
    await manager.save(row);

    return s as RefreshTokenEntity;
  });

  // Swap Redis keys (if using Redis)
  if (USE_REDIS && redis) {
    try {
      const oldKey = redisSessionKey((row as any).tokenId);
      const newKey = redisSessionKey((savedNew as any).tokenId);
      const userSetKey = redisUserSetKey(row.userId);
      const newValue = JSON.stringify({
        tokenHash: newHash,
        userId: row.userId,
        userType: row.userType,
        clientId: row.client ? (row.client as any).id : null,
        expiresAt: newExpiresAt.toISOString(),
      });

      const tx = redis.multi();
      tx.del(oldKey);
      tx.set(newKey, newValue, "EX", REFRESH_TTL_SECONDS);
      tx.sadd(userSetKey, (savedNew as any).tokenId);
      tx.srem(userSetKey, (row as any).tokenId);
      tx.expire(userSetKey, REFRESH_TTL_SECONDS);
      await tx.exec();
    } catch (e) {
      console.warn("Redis swap failed in rotateRefreshToken (DB rotation done):", e);
    }
  }

  return { newRaw, savedNew };
}

/**
 * Revoke all sessions for a user (DB + optional Redis)
 */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const RefreshRepo = AppDataSource.getRepository(RefreshToken);
  await RefreshRepo.createQueryBuilder()
    .update()
    .set({ revoked: true })
    .where("user_id = :uid", { uid: userId })
    .execute();

  if (USE_REDIS && redis) {
    try {
      const userSetKey = redisUserSetKey(userId);
      const tokenIds: string[] = await redis.smembers(userSetKey);
      if (tokenIds && tokenIds.length) {
        const tx = redis.multi();
        tokenIds.forEach((t) => tx.del(redisSessionKey(t)));
        tx.del(userSetKey);
        await tx.exec();
      }
    } catch (e) {
      console.warn("Redis revokeAllSessionsForUser failed (DB already revoked):", e);
    }
  }
}
