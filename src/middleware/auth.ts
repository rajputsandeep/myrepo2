// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../services/jwt";
import { config } from "../config";
import { createError } from "./errorHandler";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = (req.headers["authorization"] || "").toString();
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw createError(401, "Missing Bearer token");
    }

    // verifyJwt should throw if invalid/expired
    const decoded: any = verifyJwt(token);

    decoded.clientId =
      decoded.clientId ??
      null;

    decoded.clientId = decoded.clientId ?? decoded.clientId ?? null;

    decoded.role = decoded.role ?? decoded.typ ?? decoded.type ?? null;
    req.user = decoded;
    req.clientId = (req.headers["x-tenant-id"] as string) || decoded.clientId || null;

    // check skipTenantHeader logic (Super Admin, Admin, Tenant bypass tenant header check)
    const roleLower = (decoded.role || "").toLowerCase();
    const skipTenantHeader =
      roleLower === "superadmin" || roleLower === "admin" || roleLower === "superuser";

    if (config.enforceTenantHeader && !skipTenantHeader) {
      const tenantHeader = req.headers["x-tenant-id"] as string | undefined;

      if (!tenantHeader) {
        throw createError(403, "Tenant header required. Provide X-Tenant-Id.");
      }
      if (!decoded.clientId && !decoded.clientId) {
        throw createError(403, "Token missing tenant scope.");
      }
      // When header present, ensure it matches token's clientId/clientId
      if (tenantHeader !== (decoded.clientId || decoded.clientId)) {
        throw createError(403, "Tenant mismatch. Provide correct X-Tenant-Id header.");
      }
    }

    return next();
  } catch (err: any) {
    const message = err?.message ?? "Invalid or expired token";
    next(createError(401, message));
  }
}
