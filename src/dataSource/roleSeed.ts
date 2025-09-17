import { DataSource } from "typeorm";
import { Role } from "../entities/Role";

export async function seedRolesOnce(ds: DataSource) {
  const roleRepo = ds.getRepository(Role);

  const roles = [
    { name: "superadmin", description: "Super Admin with global privileges" },
    { name: "superuser", description: "Super User with elevated privileges" },
    { name: "admin", description: "Administrator role for clients" },
    { name: "agent", description: "Agent role for handling tickets/calls" },
    { name: "auditor", description: "Auditor role with read-only access" },
    { name: "reviewer", description: "Reviewer role for approvals" },
  ];

  for (const r of roles) {
    const existing = await roleRepo.findOne({ where: { name: r.name } });
    if (!existing) {
      const role = roleRepo.create({
        name: r.name,
        description: r.description,
        client: null,     
        isGlobal: true,       
        createdById: null,    
        updatedById: null,
      });
      await roleRepo.save(role);
    }
  }

  console.log("✅ Roles seeded successfully");
}
