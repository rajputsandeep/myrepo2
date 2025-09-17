import { Request, Response, NextFunction } from "express";
import { createError } from "./errorHandler";

/**
 * Role-based access guard
 * Usage: app.get("/admin", requireAuth, allowRoles("Admin", "SuperAdmin"), handler)
 */
export function allowRoles(...allowed: string[]) {
  const set = new Set(allowed.map((r) => r.toLowerCase()));

  return (req: Request, _res: Response, next: NextFunction) => {
    const role = (req.user?.role || "").toLowerCase();

    if (!role || !set.has(role)) {
      return next(createError(403, "Forbidden: insufficient role"));
    }

    return next();
  };
}
