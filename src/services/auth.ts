// src/services/auth.ts
import { AppDataSource } from "../dataSource/data-source";
import { createError } from "../middleware/errorHandler";
import bcrypt from "bcrypt";
import { Superadmin } from "../entities/SuperAdmin";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { LoginAttempt } from "../entities/LoginAttempts";
import { DepartmentUser } from "../entities/DepartmentUser";

export interface AuthSubject {
  id: string;
  email: string;
  type: string; // role name or "department_user"
  clientId?: string | null;
  userName?: string | null;
  roleId?: string;
}

const MAX_FAILED_ATTEMPTS = Number(process.env.MAX_FAILED_ATTEMPTS || 5);

export async function findAuthSubject(
  email: string,
  password: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<AuthSubject | null> {
  if (!email || !password) return null;
  const e = (email || "").toLowerCase().trim();

  if (!AppDataSource?.isInitialized) {
    throw createError(500, "DB not initialized");
  }

  const superRepo = AppDataSource.getRepository(Superadmin);
  const userRepo = AppDataSource.getRepository(User);
  const deptUserRepo = AppDataSource.getRepository(DepartmentUser);
  const laRepo = AppDataSource.getRepository(LoginAttempt);

  // 1) Superadmin
  const dbSuper = await superRepo
    .createQueryBuilder("s")
    .leftJoinAndSelect("s.role", "r")
    .where("LOWER(s.email) = LOWER(:email)", { email: e })
    .getOne();

  if (dbSuper) {
    const isValid = await bcrypt.compare(password, dbSuper.passwordHash);
    await laRepo.save(
      laRepo.create({
        user: null,
        userId: null,
        email: e,
        ipAddr: ip || null,
        userAgent: userAgent || null,
        success: !!isValid,
        reason: isValid ? null : "wrong_password",
      } as any)
    );
    if (!isValid) return null;

    return {
      id: dbSuper.superadminId,
      email: dbSuper.email,
      type: "superadmin",
      clientId: null,
      userName: dbSuper.username || null,
      roleId: dbSuper.role ? (dbSuper.role as Role).roleId : undefined,
    };
  }

  // 2) Client User
  const dbUser = await userRepo
    .createQueryBuilder("u")
    .addSelect("u.passwordHash")
    .leftJoinAndSelect("u.role", "r")
    .leftJoinAndSelect("u.Client", "c")
    .where("LOWER(u.email) = LOWER(:email)", { email: e })
    .getOne();

  if (dbUser) {
    if ((dbUser as any).status === "DEACTIVATED") {
      await laRepo.save(
        laRepo.create({
          user: dbUser,
          userId: dbUser.id,
          email: e,
          ipAddr: ip || null,
          userAgent: userAgent || null,
          success: false,
          reason: "account_deactivated",
        } as any)
      );
      throw createError(
        403,
        "Your account has been blocked due to too many failed login attempts. Please contact your administrator."
      );
    }

    const isValid = await bcrypt.compare(password, dbUser.passwordHash);
    await laRepo.save(
      laRepo.create({
        user: dbUser,
        userId: dbUser.id,
        email: e,
        ipAddr: ip || null,
        userAgent: userAgent || null,
        success: !!isValid,
        reason: isValid ? null : "wrong_password",
      } as any)
    );

    if (isValid) {
      await userRepo.update({ id: dbUser.id } as any, {
        failedLoginAttempts: 0,
        lockedAt: null,
      } as any);

      const roleName = dbUser.role?.name?.toLowerCase() || "user";
      const clientRel = (dbUser as any).Client || null;

      return {
        id: dbUser.id,
        email: dbUser.email,
        type: roleName,
        clientId: clientRel ? clientRel.id ?? null : null,
        userName: (dbUser as any).displayName || (dbUser as any).username || null,
        roleId: dbUser.role ? (dbUser.role as Role).roleId : undefined,
      };
    }

    // password wrong for client user
    await userRepo.increment({ id: dbUser.id } as any, "failedLoginAttempts", 1);
    const refreshed = await userRepo.findOne({ where: { id: dbUser.id } as any });
    if ((refreshed as any)?.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await userRepo.update({ id: dbUser.id } as any, {
        status: "DEACTIVATED",
        lockedAt: new Date(),
      } as any);
      throw createError(
        403,
        "Your account has been blocked due to too many failed login attempts. Please contact your administrator."
      );
    }
    return null;
  }

  // 3) Department User
  const dbDeptUser = await deptUserRepo
    .createQueryBuilder("du")
    .addSelect("du.passwordHash")
    .leftJoinAndSelect("du.roleMappings", "rm")
    .leftJoinAndSelect("rm.role", "dr")
    .leftJoinAndSelect("du.department", "d")
    .where("LOWER(du.email) = LOWER(:email)", { email: e })
    .getOne();

    console.log("department user", dbDeptUser)
  if (dbDeptUser) {
    const isValid = await bcrypt.compare(password, dbDeptUser.passwordHash || "");
await laRepo.save(
  laRepo.create({
    userId: null,
    departmentUserId: null,
    email: e,
    ipAddr: ip || null,
    userAgent: userAgent || null,
    success: !!isValid,
    reason: isValid ? null : "wrong_password"
  } as any)
);


    if (!isValid) return null;

    const primaryRole = dbDeptUser.roleMappings?.find((r) => r.primaryRole)?.role;
    return {
      id: dbDeptUser.id,
      email: dbDeptUser.email || "",
      type: "department_user",
      clientId: dbDeptUser.departmentId, // agar department se client link h to adjust yaha
      userName: dbDeptUser.fullname,
      roleId: primaryRole?.id ?? null,
    };
  }

  return null;
}
