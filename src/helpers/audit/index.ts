// src/services/auditLogger.ts
import { AppDataSource } from "../../dataSource/data-source";
import { AuditLog } from "../../entities/AuditLogs";


export async function audit({
  req,
  clientId,
  actorId,
  actorType,
  action,
  resource,
  meta,
}: {
  req?: any; 
  clientId?: string;
  actorId?:string;
  actorType?:string;
  action: string;
  resource: string;
  meta?: any;
}) {
  const repo = AppDataSource.getRepository(AuditLog);
  const log = repo.create({
    client: clientId ? ({ id: clientId } as any) : undefined,
    actorId,
    actorType,
    action,
    resource,
    meta,
  });

  await repo.save(log);
}
