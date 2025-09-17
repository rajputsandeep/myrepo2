// src/services/auth.service.ts
import crypto from "crypto";
import { createHash } from "crypto";
import { AppDataSource } from "../dataSource/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { Client } from "../entities/Client";

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
const REFRESH_BYTES = 48;
const REFRESH_HASH_ALGO = "sha256";

function hashToken(raw: string): string {
  return createHash(REFRESH_HASH_ALGO).update(raw).digest("hex");
}

/**
 * Issue new refresh token (enforces single session)
 */
export async function issueRefreshToken({
  userId,
  clientId,
  userType = "user",
}: {
  userId: string;
  clientId?: string | null;
  userType?: "user" | "superadmin";
}) {
  const RefreshRepo = AppDataSource.getRepository(RefreshToken);

  const raw = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  // revoke previous tokens (single session)
  await RefreshRepo.createQueryBuilder()
    .update()
    .set({ revoked: true })
    .where(`user_id = :uid AND revoked = false`, { uid: userId })
    .execute();

  const newRow = RefreshRepo.create({
    userType,
    userId,
    client: clientId ? ({ id: clientId } as Client) : null,
    tokenHash,
    revoked: false,
    expiresAt,
  } as any);

  const saved = await RefreshRepo.save(newRow);

  return { token: raw, saved };
}

/**
 * Rotate refresh token (refresh flow)
 */
export async function rotateRefreshToken(rawToken: string) {
  const RefreshRepo = AppDataSource.getRepository(RefreshToken);
  const hash = hashToken(rawToken);

  const row = await RefreshRepo.findOne({
    where: { tokenHash: hash } as any,
    relations: ["client"],
  });

  if (!row || row.revoked) throw new Error("Invalid refresh token");
  if (row.expiresAt && row.expiresAt <= new Date()) throw new Error("Expired refresh token");

  const rawNew = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  const newHash = hashToken(rawNew);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const savedNew = await AppDataSource.manager.transaction(async (manager) => {
    row.revoked = true;
    await manager.save(row);

    const newRow = manager.create(RefreshToken, {
      userType: row.userType,
      userId: row.userId,
      client: row.client ?? null,
      tokenHash: newHash,
      revoked: false,
      expiresAt,
    } as any);

    const saved = await manager.save(newRow);
    row.replacedByTokenId = saved.tokenId;
    await manager.save(row);

    return saved;
  });

  return { rawNew, savedNew };
}

/**
 * Logout (revoke token)
 */
export async function logoutRefreshToken(rawToken: string) {
  const RefreshRepo = AppDataSource.getRepository(RefreshToken);
  const hash = hashToken(rawToken);

  await RefreshRepo.createQueryBuilder()
    .update()
    .set({ revoked: true })
    .where(`token_hash = :hash AND revoked = false`, { hash })
    .execute();
}
