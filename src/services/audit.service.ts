// src/services/auditService.ts
import { AppDataSource } from "../dataSource/data-source";
import { AuditLog } from "../entities/AuditLogs";

export async function logAudit({
  clientId,
  actorId,
  actorType,
  action,
  resource,
  meta,
}: {
  clientId?: string;
  actorId?: string;
  actorType?: string;
  action: string;
  resource?: string;
  meta?: any;
}) {
  const repo = AppDataSource.getRepository(AuditLog);

  const log = repo.create({
    client: clientId ? { id: clientId } as any : undefined,
    actorId,
    actorType,
    action,
    resource,
    meta,
  });

  await repo.save(log);
}
