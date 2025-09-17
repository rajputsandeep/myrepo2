import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";

export async function seedSuperAdminOnce(ds: DataSource) {
  const hashedPassword = await bcrypt.hash("Password@123", 10);

  // ✅ Fetch superadmin role
  const role = await ds.query(
    `SELECT role_id FROM roles WHERE name = $1 LIMIT 1`,
    ["superadmin"]
  );
  if (!role || role.length === 0) {
    throw new Error("⚠️ Superadmin role not seeded yet");
  }
  const roleId = role[0].role_id;

  // ✅ Check if superadmin already exists
  const existing = await ds.query(
    `SELECT superadmin_id FROM superadmins WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    ["sandeep.kumar@edas.tech"]
  );

  if (existing.length > 0) {
    console.log("ℹ️ SuperAdmin already exists, skipping seed");
    return;
  }

  // ✅ Insert new superadmin
  await ds.query(
    `
    INSERT INTO superadmins
      (username, email, password_hash, first_name, last_name, is_active, created_at, role_id, phone_number)
    VALUES
      ($1, $2, $3, $4, $5, true, NOW(), $6, $7)
    `,
    [
      "SuperAdmin", // username
      "sandeep.kumar@edas.tech", // email
      hashedPassword, // password_hash
      "Sandeep", // first_name
      "Kumar", // last_name
      roleId, // role_id
      "8904420415", // phone_number ✅ added correctly here
    ]
  );

  console.log("✅ SuperAdmin seeded successfully");
}
