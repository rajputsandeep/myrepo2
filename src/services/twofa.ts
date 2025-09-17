import { AppDataSource } from "../dataSource/data-source";
import { send2FACode } from "./mailer";
import { TwoFactor } from "../entities/TwoFactor";
import { Repository } from "typeorm";
import bcrypt from "bcrypt";

const TFCRepo = (): Repository<TwoFactor> =>
  AppDataSource.getRepository(TwoFactor);

function randomCode(): string {
  // 6-digit numeric
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a new 2FA challenge and send code via email
 */
export async function createAndSendChallenge({
  userId,
  email,
  role,
  ClientId,
  ip,
  userAgent,
  ttlMinutes = 1,
}: {
  userId: string;
  email: string;
  role: string;
  ClientId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  ttlMinutes?: number;
}) {
  // const code = randomCode();
  const code ="123456"
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // 🔐 Hash the code before storing
  const hashedCode = await bcrypt.hash(code, 10);

  const row = TFCRepo().create({
    userId,
    email,
    code: hashedCode,
    expiresAt: expires,
    attempts: 0,
    clientId: ClientId ?? null,
    role: role ?? null,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
    purpose: "login",
    lastSentAt: new Date(),
  });

  const saved = await TFCRepo().save(row);

  await send2FACode({ to: email, code }); // send plain code to email

  return { challengeId: saved.id, expiresAt: saved.expiresAt };
}

/**
 * Resend code for an existing challenge (with 30s throttle)
 */
export async function resendChallenge(challengeId: string) {
  const row = await TFCRepo().findOne({ where: { id: challengeId } });
  if (!row) throw new Error("Challenge not found");
  if (row.consumedAt) throw new Error("Challenge already consumed");

  // throttle: 1 resend per 30s
  if (row.lastSentAt && Date.now() - new Date(row.lastSentAt).getTime() < 30_000) {
    throw new Error("Please wait before resending");
  }

  const code = randomCode();
  
  const hashedCode = await bcrypt.hash(code, 10);

  row.code = hashedCode;
  row.lastSentAt = new Date();
  row.expiresAt = new Date(Date.now() + 1 * 60 * 1000);
  row.attempts = 0; // reset attempts on resend
  await TFCRepo().save(row);

  await send2FACode({ to: row.email, code });

  return { challengeId: row.id, expiresAt: row.expiresAt };
}


export async function verifyChallenge({
  challengeId,
  code,
}: {
  challengeId: string;
  code: string;
}) {
  const row = await TFCRepo().findOne({ where: { id: challengeId } });
  if (!row) return { ok: false, error: "Challenge not found" };

  if (row.consumedAt) return { ok: false, error: "Already verified" };

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: "Code expired" };
  }

  // max 5 attempts
  if ((row.attempts || 0) >= 5) {
    return { ok: false, error: "Too many attempts" };
  }

  const isValid = await bcrypt.compare(code.trim(), row.code || "");
  if (!isValid) {
    row.attempts = (row.attempts || 0) + 1;
    await TFCRepo().save(row);
    return { ok: false, error: "Invalid code" };
  }

  // success
  row.consumedAt = new Date();
  await TFCRepo().save(row);

  return {
    ok: true,
    userId: row.userId,
    email: row.email,
    role: row.role,
    clientId: row.clientId,
  };
}
