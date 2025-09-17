// src/seeds/seedDepartments.ts
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";

import { Department } from "../entities/Department";
import { DepartmentRole } from "../entities/DepartmentRole";
import { DepartmentUser } from "../entities/DepartmentUser";
import { DepartmentUserRole } from "../entities/DepartmentUserRole";
import { LoginAttempt } from "../entities/LoginAttempts";

export async function seedDefaultDepartments(ds: DataSource) {
  const deptRepo = ds.getRepository(Department);
  const roleRepo = ds.getRepository(DepartmentRole);
  const userRepo = ds.getRepository(DepartmentUser);
  const durRepo = ds.getRepository(DepartmentUserRole);

  // configurable
  const passwordPlain = "Password@123";
  const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(passwordPlain, SALT_ROUNDS);

  // desired seed
  const departmentsToCreate = [
    { name: "Sales", displayName: "Sales Head", email: "sales.head@company.com", mobile: "+911234567890" },
    { name: "Finance", displayName: "Finance Head", email: "finance.head@company.com", mobile: "+911234567891" },
    { name: "CEO", displayName: "CEO", email: "ceo@company.com", mobile: "+911234567892" },
  ];

  const results: any[] = [];

  for (const d of departmentsToCreate) {
    // 1) ensure department exists (by name)
    let dept = await deptRepo.findOne({ where: { name: d.name } as any });
    if (!dept) {
      dept = deptRepo.create({
        name: d.name,
        description: `${d.name} department (seed)`,
      } as any);
      dept = await deptRepo.save(dept);
      console.log(`Seed: created department '${d.name}' id=${(dept as any).id}`);
    } else {
      console.log(`Seed: department '${d.name}' already exists id=${(dept as any).id}`);
    }

    // 2) ensure role "Head" exists for this dept
    let role = await roleRepo.findOne({ where: { departmentId: (dept as any).id, name: "Head" } as any });
    if (!role) {
      role = roleRepo.create({
        department: dept,
        departmentId: (dept as any).id,
        name: "Head",
        description: `${d.name} head role`,
        isDefaultForHead: true,
      } as any);
      role = await roleRepo.save(role);
      console.log(`Seed: created role 'Head' for dept ${d.name} id=${(role as any).id}`);
    } else {
      console.log(`Seed: role 'Head' for dept ${d.name} already exists id=${(role as any).id}`);
    }

    // 3) ensure DepartmentUser exists for this dept (by email)
    let user = await userRepo.findOne({ where: { email: d.email } as any });
    if (!user) {
      user = userRepo.create({
        department: dept,
        departmentId: (dept as any).id,
        fullname: d.displayName,
        email: d.email,
        mobile: d.mobile,
        passwordHash,
        isActive: true,
        status:"ACTIVE",
        LoginAttempt:0,
        isHead: true,
        managerId: null,
      } as any);
      user = await userRepo.save(user);
      console.log(`Seed: created user ${d.email} id=${(user as any).id}`);
    } else {
      // ensure user is linked to this department — if not, update
      let needsSave = false;
      if ((user as any).departmentId !== (dept as any).id) {
        (user as any).department = dept;
        (user as any).departmentId = (dept as any).id;
        needsSave = true;
      }
      // mark head flag true
      if (!(user as any).isHead) {
        (user as any).isHead = true;
        needsSave = true;
      }
      if (!(user as any).isActive) {
        (user as any).isActive = true;
        needsSave = true;
      }
      if (needsSave) {
        user = await userRepo.save(user);
        console.log(`Seed: updated existing user ${d.email} to belong to ${d.name}`);
      } else {
        console.log(`Seed: user ${d.email} already exists and linked`);
      }
    }

    // 4) ensure mapping in department_user_roles exists (primaryRole true)
    let mapping = await durRepo.findOne({
      where: {
        userId: (user as any).id,
        roleId: (role as any).id,
      } as any,
    });

    if (!mapping) {
      mapping = durRepo.create({
        user: user,
        userId: (user as any).id,
        role: role,
        roleId: (role as any).id,
        primaryRole: true,
      } as any);
      mapping = await durRepo.save(mapping);
      console.log(`Seed: created department_user_role for user ${d.email} role Head`);
    } else {
      // ensure primaryRole true
      if (!mapping.primaryRole) {
        (mapping as any).primaryRole = true;
        mapping = await durRepo.save(mapping);
        console.log(`Seed: updated department_user_role.set primaryRole true for ${d.email}`);
      } else {
        console.log(`Seed: mapping already exists for ${d.email}`);
      }
    }

    results.push({
      department: { id: (dept as any).id, name: dept.name },
      role: { id: (role as any).id, name: role.name },
      user: { id: (user as any).id, email: user.email },
      mapping: { id: (mapping as any).id },
    });
  }

  console.log("Seed departments finished");
  return results;
}

// usage example:
// import { DataSource } from "typeorm";
// import { seedDefaultDepartments } from "./seeds/seedDepartments";
// const ds = new DataSource(...)
// await seedDefaultDepartments(ds);
