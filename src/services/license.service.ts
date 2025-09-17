// services/licenseService.ts
import { DataSource } from "typeorm";
import { Client } from "../entities/Client";
import { LicenseAllocation } from "../entities/LicenseAllocation";
import { LicenseTypeMaster } from "../entities/LicenseTypeMaster";

type LicenseMap = Record<string, number>; // e.g. { ADMIN: 5, AGENT: 100, REVIEWER: 3 }

export async function allocateLicensesForClient(
  dataSource: DataSource,
  client: Client,
  licenseMap: LicenseMap
): Promise<LicenseAllocation[]> {
  return await dataSource.transaction(async (manager) => {
    const licenseTypeRepo = manager.getRepository(LicenseTypeMaster);
    const allocationRepo = manager.getRepository(LicenseAllocation);

    const allocations: LicenseAllocation[] = [];
    const codes = Object.keys(licenseMap);
    if (codes.length === 0) return [];

    const masters = await licenseTypeRepo.findByIds(codes, { where: { code: codes } as any });
    const masterByCode = new Map<string, LicenseTypeMaster>();
    for (const m of masters) masterByCode.set(m.code, m);
    const missing = codes.filter((c) => !masterByCode.has(c));
    if (missing.length > 0) {
      throw new Error(`LicenseTypeMaster missing for codes: ${missing.join(", ")}`);
    }

    for (const [code, count] of Object.entries(licenseMap)) {
      const licenseType = masterByCode.get(code)!;

      // See if allocation already exists for this client + licenseType
      const existing = await allocationRepo.findOne({
        where: {
          Client: { id: client.id },
          licenseType: { id: licenseType.id },
        } as any,
        relations: [],
      });

      if (existing) {
        // Update allocatedCount (you can decide whether to overwrite or increment; here we overwrite)
        existing.allocatedCount = count;
        // Optionally: ensure usedCount <= allocatedCount
        if (existing.usedCount > count) {
          // You may choose to prevent shrinking below usedCount; here we enforce min
          existing.allocatedCount = existing.usedCount;
        }
        existing.requestedCount = 0; // or set as needed
        existing.lastUpdated = new Date();
        const saved = await allocationRepo.save(existing);
        allocations.push(saved);
      } else {
        const newAlloc = allocationRepo.create({
          Client: client,
          licenseType,
          allocatedCount: count,
          requestedCount: 0,
          usedCount: 0,
          createdAt: new Date(),
          lastUpdated: new Date(),
        } as Partial<LicenseAllocation>);
        const saved = await allocationRepo.save(newAlloc);
        allocations.push(saved);
      }
    }

    return allocations;
  });
}
