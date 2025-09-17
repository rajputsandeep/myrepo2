// src/services/mfa.service.ts
import { AppDataSource } from "../dataSource/data-source";
import { Client } from "../entities/Client";
import { UserMfa } from "../entities/UserMfa";
import { ClientRoleMfa } from "../entities/ClientRoleMfa";

export async function isMfaRequiredForLogin({
  clientId,
  userId,
  roleId,
}: {
  clientId?: string | null;
  userId?: string | null;
  roleId?: string | null;
}): Promise<boolean> {
  // platform-level (superadmin) users: no client MFA
  if (!clientId) return false;

  const client = await AppDataSource.getRepository(Client).findOne({ where: { id: clientId } as any });
  if (!client) return false;

  // if client global MFA disabled -> no MFA for this client
  if (!client.mfaEnabled) return false;

  // 1) user-level override (email)
  if (userId) {
    const um = await AppDataSource.getRepository(UserMfa).findOne({ where: { userId, mfaType: "email" } as any });
    if (um) {
      return Boolean(um.enabled);
    }
  }

  // 2) role-level policy using roleId (preferred)
  if (roleId) {
    const rp = await AppDataSource.getRepository(ClientRoleMfa).findOne({
      where: { clientId, roleId } as any,
    });
    if (rp) {
      return Boolean(rp.mfaRequired);
    }
  }

  // 3) default: client enabled but no specific settings -> do not force MFA
  return false;
}
