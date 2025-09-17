import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import { config } from "../config";
import { createError } from "../middleware/errorHandler";

/** JWT Payload type */
export interface JwtUserPayload extends JwtPayload {
  sub: string;          // user id
  email: string;
  role: string;
  client_id?: string | null;
}

/** Sign JWT */
export function signJwt(
  payload: JwtUserPayload,
  options: SignOptions = {}
): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    ...options,
  });
}

/** Verify JWT safely */
export function verifyJwt(token: string): JwtUserPayload {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtUserPayload;
  } catch (err) {
    throw createError(401, "Invalid or expired token");
  }
}
