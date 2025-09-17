// seed/licenseTypes.seed.ts
import { AppDataSource } from "../dataSource/data-source";
import { LicenseTypeMaster } from "../entities/LicenseTypeMaster";

export async function seedLicenseTypes() {
  const repo = AppDataSource.getRepository(LicenseTypeMaster);

  const defaults = [
    { code: "ADMIN", name: "Administrator", description: "Full access to client account" },
    { code: "AGENT", name: "Agent", description: "Handles tickets/calls" },
    { code: "MANAGER", name: "Manager", description: "Supervises agents" },
    { code: "REVIEWER", name: "Reviewer", description: "Reviews interactions" },
    { code: "SUPERVISOR", name: "Supervisor", description: "Manages team performance" },
     { code: "CHANNEL", name: "Channel", description: "Channel for calling" },
  ];

  for (const d of defaults) {
    const existing = await repo.findOne({ where: { code: d.code } });
    if (!existing) {
      const newType = repo.create(d);
      await repo.save(newType);
    }
  }
}
