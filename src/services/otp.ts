
import crypto from "crypto";

export function generateNumericOtp(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}

export function hashCode(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
