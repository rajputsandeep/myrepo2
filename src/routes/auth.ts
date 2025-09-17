// src/routes/auth.ts
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { signJwt } from "../services/jwt";
import { findAuthSubject } from "../services/auth";
import { AppDataSource } from "../dataSource/data-source";
import { createAndSendChallenge, resendChallenge, verifyChallenge } from "../services/twofa";
import { createError } from "../middleware/errorHandler";
import { RefreshToken } from "../entities/RefreshToken";
import { issueRefreshToken, rotateRefreshToken } from "../services/session.service";
import { isMfaRequiredForLogin } from "../services/mfa.service";
import { audit } from "../helpers/audit";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const verifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(4).max(10),
});
const resendSchema = z.object({
  challengeId: z.string().uuid(),
});



router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(400, "Invalid payload", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const subject = await findAuthSubject(email, password);
    if (!subject) {
      console.log("login: invalid credentials for", email);

      // audit failed login (anonymous)
      try {
        await audit({
          req,
          action: "LOGIN_FAILED",
          resource: "User",
          meta: { email },
        });
      } catch (e) {
        console.warn("audit failed for LOGIN_FAILED", e);
      }

      throw createError(401, "Invalid credentials");
    }

    const clientId = subject.clientId ?? null;
    const userId = subject.id;
    const roleId = (subject as any).roleId ?? null; // ensure findAuthSubject returns roleId

    const mfaRequired = await isMfaRequiredForLogin({ clientId, userId, roleId });
    // debug log for subject returned from auth
    console.log("login: subject found:", {
      id: subject.id,
      email: subject.email,
      type: subject.type,
      clientId: subject.clientId ?? null,
      roleId: subject.roleId ?? null,
    });

    if (!mfaRequired) {
      console.log("mfarequired", mfaRequired);
      // ---------- NON-MFA path: issue refresh token + access token ----------
      console.log("login: MFA not required, issuing tokens for", userId);

      const { raw: refreshTokenRaw, saved } = await issueRefreshToken({
        userId: userId,
        email: subject.email,
        clientId: clientId,
        userType: String(subject.type).toLowerCase() === "superadmin" ? "superadmin" : "user",
        ipAddr: (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip) ?? null,
        userAgent: req.get("user-agent") || null,
      });

      // include sessionId so sessionGuard can validate access tokens later
      const payload: any = {
        sub: userId,
        email: subject.email,
        role: subject.type,
        clientId: clientId,
        sessionId: (saved as any).tokenId,
      };
      if ((subject as any).roleId) payload.roleId = (subject as any).roleId;

      const accessToken = signJwt(payload);

      const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
      res.cookie("refresh_token", refreshTokenRaw, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: "/",
      });

      // audit successful login (non-MFA)
      try {
        await audit({
          req,
          clientId,
          actorId: userId,
          actorType:subject.type,
          action: "LOGIN_SUCCESS",
          resource: "Auth",
          meta: {
            email: subject.email,
            sessionId: (saved as any).tokenId,
            userAgent: req.get("user-agent") || null,
            ip: (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip) ?? null,
          },
        });
      } catch (e) {
        console.warn("audit failed for LOGIN_SUCCESS", e);
      }

      return res.json({
        success: true,
        msg: "Login success (no MFA)",
        token: accessToken,
        payload,
      });
    } else {
      // MFA required: create & send challenge
      const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip) ?? null;
      const userAgent = req.get("user-agent") || null;

      const { challengeId, expiresAt } = await createAndSendChallenge({
        userId: subject.id,
        email: subject.email,
        role: subject.type,
        ClientId: subject.clientId ?? null,
        ip,
        userAgent,
        ttlMinutes: 1,
      });

      // audit that MFA challenge was created/sent
      try {
        await audit({
          req,
          clientId,
          actorId: userId,
           actorType:subject.type,
          action: "LOGIN_MFA_CHALLENGE_SENT",
          resource: "Auth",
          meta: {
            email: subject.email,
            challengeId,
            expiresAt,
            ip,
            userAgent,
          },
        });
      } catch (e) {
        console.warn("audit failed for LOGIN_MFA_CHALLENGE_SENT", e);
      }

      return res.json({
        success: true,
        msg: "Verification code sent to your email",
        challengeId,
        expiresAt,
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post(
  "/2fa/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw createError(400, "Invalid payload", parsed.error.flatten());
      }
      const { challengeId, code } = parsed.data;

      const result = await verifyChallenge({ challengeId, code });
      if (!result.ok) {
        console.log("2fa verify failed for challenge:", challengeId);

        // 🔥 Failed Attempt ko bhi log karo
        await audit({
          req,
          clientId: result.clientId ?? null,
          action: "2FA_VERIFY_FAILED",
          resource: "Auth",
          meta: { challengeId, email: result.email, reason: result.error },
        });

        throw createError(400, result.error || "Invalid code");
      }

      // Issue DB-backed refresh token + single-session enforcement
      console.log("2fa verify: issuing refresh token for", result.userId, result.email, {
        clientId: result.clientId,
      });

      const { raw: refreshTokenRaw, saved } = await issueRefreshToken({
        userId: result.userId,
        email: result.email,
        clientId: result.clientId ?? null,
        userType:
          String(result.role).toLowerCase() === "superadmin"
            ? "superadmin"
            : "user",
        ipAddr: req.ip || null,
        userAgent: req.get("user-agent") || null,
      });

      console.log("2fa verify: refresh token created tokenId=", (saved as any).tokenId);

      // Build JWT payload including sessionId so sessionGuard can validate access tokens
      const payload: any = {
        sub: result.userId,
        email: result.email,
        role: result.role,
        clientId: result.clientId ?? null,
        sessionId: (saved as any).tokenId,
      };
      if ((result as any).roleId) payload.roleId = (result as any).roleId;

      const accessToken = signJwt(payload);

      // cookie options
      const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
      res.cookie("refresh_token", refreshTokenRaw, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: "/",
      });

      // 🔥 Successful 2FA Verify log karo
      await audit({
        req,
        clientId: result.clientId ?? null,
        action: "2FA_VERIFY_SUCCESS",
        resource: "Auth",
        meta: {
          challengeId,
          email: result.email,
          userId: result.userId,
          role: result.role,
        },
      });

      return res.json({
        success: true,
        token: accessToken,
        payload,
      });
    } catch (err) {
      next(err);
    }
  }
);



/**
 * Refresh -> rotate refresh token, issue new access token (DB-only)
 */
router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.cookies?.["refresh_token"];
    if (!raw) {
      throw createError(401, "Missing refresh token");
    }

    console.log("refresh: rotating token for cookie present");

    const { newRaw, savedNew } = await rotateRefreshToken(raw);

    console.log("refresh: rotated refresh token, new tokenId=", (savedNew as any).tokenId);

    const payload: any = {
      sub: (savedNew as any).userId,
      email: (savedNew as any).email,
      role: (savedNew as any).userType === "superadmin" ? "superadmin" : (savedNew as any).userType,
      clientId: (savedNew as any).client ? (savedNew as any).client.id : null,
      sessionId: (savedNew as any).tokenId,
    };

    const newAccessToken = signJwt(payload);

    const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);
    res.cookie("refresh_token", newRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({ success: true, token: newAccessToken, payload });
  } catch (err) {
    next(err);
  }
});

/**
 * Logout -> revoke refresh token(s) and clear cookie
 */
router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.cookies?.["refresh_token"];
    if (raw) {
      try {
        const hash = crypto.createHash("sha256").update(raw).digest("hex");
        // revoke any token row matching this hash
        await AppDataSource.getRepository(RefreshToken)
          .createQueryBuilder()
          .update()
          .set({ revoked: true })
          .where("token_hash = :hash", { hash })
          .execute();

        console.log("logout: revoked refresh token with hash", hash);
      } catch (e) {
        console.warn("logout: failed to revoke refresh token", e);
      }
      res.clearCookie("refresh_token");
    }
    return res.json({ success: true, msg: "Logged out" });
  } catch (err) {
    next(err);
  }
});


/**
 * STEP 1b: Resend code for an existing challenge
 */
router.post("/2fa/resend", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(400, "Invalid payload", parsed.error.flatten());
    }
    const { challengeId } = parsed.data;

    const out = await resendChallenge(challengeId);
    return res.json({ success: true, msg: "Code resent", ...out });
  } catch (err) {
    next(err);
  }
});


/* -----------------------
   Forgot / Reset password
   ----------------------- */

// /** Forgot password: create a short-lived reset token and email it */
// router.post("/forgot-password", async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { email } = req.body || {};
//     if (!email) throw createError(400, "Email is required");

//     // First try platform users, then client users as needed
//     const user = await UserRepo().findOne({ where: { email } });
//     if (!user) {
//       // Optionally you may want to allow tenant/client fallback search; adjust per policy
//       return res.status(404).json({ success: false, error: "User not found" });
//     }

//     const token = crypto.randomBytes(32).toString("hex");
//     const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

//     const reset = ResetRepo().create({
//       userId: user.userId,
//       token,
//       expiresAt: expires,
//       used: false,
//     } as any);
//     await ResetRepo().save(reset);

//     // send email (dev fallback logs)
//     await send2FACode({ to: email, code: `Reset token: ${token}` });

//     return res.json({ success: true, msg: "Password reset instructions sent" });
//   } catch (err) {
//     next(err);
//   }
// });

// /** Reset password: apply token */
// router.post("/reset-password", async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { token, newPassword } = req.body || {};
//     if (!token || !newPassword) throw createError(400, "token and newPassword required");

//     const reset = await ResetRepo().findOne({ where: { token } });
//     if (!reset || (reset as any).used) throw createError(400, "Invalid or used token");

//     if (new Date((reset as any).expiresAt).getTime() < Date.now()) {
//       throw createError(400, "Token expired");
//     }

//     // Find the user and update password
//     const userId = (reset as any).userId;
//     const user = await UserRepo().findOne({ where: { userId } });
//     if (!user) throw createError(404, "User not found");

//     const hashed = await bcrypt.hash(newPassword, 10);
//     user.passwordHash = hashed;
//     await UserRepo().save(user);

//     // mark reset used
//     (reset as any).used = true;
//     await ResetRepo().save(reset);

//     return res.json({ success: true, msg: "Password reset successful" });
//   } catch (err) {
//     next(err);
//   }
// });

export default router;
