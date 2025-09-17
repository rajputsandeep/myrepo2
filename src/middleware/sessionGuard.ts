// // src/middleware/sessionGuard.ts
// import { Request, Response, NextFunction } from "express";
// import { AppDataSource } from "../dataSource/data-source";
// import { RefreshToken } from "../entities/RefreshToken";
// import { redis } from "../lib/redis"; // optional, only if USE_REDIS
// import { createError } from "./errorHandler";

// const USE_REDIS = String(process.env.USE_REDIS || "false") === "true";

// export async function sessionGuard(req: Request, res: Response, next: NextFunction) {
//   try {
//     const user = req.user as any;
//     if (!user) return next(); // no auth info - let requireAuth handle it earlier

//     const sessionId = user.sessionId as string | undefined;
//     if (!sessionId) return next(); // session checking not available - allow

//     // 1) Prefer Redis check (fast)
//     if (USE_REDIS && redis) {
//       try {
//         const key = `session:${sessionId}`;
//         const s = await redis.get(key);
//         if (!s) {
//           // session missing in redis => invalidated
//           return next(createError(401, "Session invalidated. Please login again."));
//         }
//         // still valid
//         return next();
//       } catch (e) {
//         // Redis failed - fallback to DB check
//         console.warn("sessionGuard: redis check failed, falling back to DB", e);
//       }
//     }

//     // 2) DB fallback
//     const rt = await AppDataSource.getRepository(RefreshToken).findOne({
//       where: { tokenId: sessionId } as any,
//     });
//     if (!rt || rt.revoked || (rt.expiresAt && rt.expiresAt <= new Date())) {
//       return next(createError(401, "Session invalidated. Please login again."));
//     }

//     return next();
//   } catch (err) {
//     return next(createError(401, "Session validation failed"));
//   }
// }
// src/middleware/sessionGuard.ts
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../dataSource/data-source";
import { RefreshToken } from "../entities/RefreshToken";
import { createError } from "./errorHandler";

export async function sessionGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as any;
    if (!user) return next(); // requireAuth will catch missing user

    const sessionId = user.sessionId as string | undefined;
    if (!sessionId) return next(); // session not tracked, allow

    // Only DB check (Redis disabled in dev)
    const rt = await AppDataSource.getRepository(RefreshToken).findOne({
      where: { tokenId: sessionId } as any,
    });
console.log("session", rt)
    if (!rt || rt.revoked || (rt.expiresAt && rt.expiresAt <= new Date())) {
      return next(createError(401, "Session invalidated. Please login again."));
    }

    return next();
  } catch (err) {
    return next(createError(401, "Session validation failed"));
  }
}
