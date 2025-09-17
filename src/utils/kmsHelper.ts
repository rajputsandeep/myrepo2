// --- KMS / encryption helper (replace with real KMS / Vault) ---
export async function encryptSecret(plain: string): Promise<{ ciphertext: string; kmsKeyId?: string }> {
  // TODO: replace this stub with real KMS encryption call (AWS KMS / GCP KMS / Vault)
  // For now we do a base64-encode as placeholder (DO NOT USE IN PRODUCTION).
  const ciphertext = Buffer.from(plain).toString("base64");
  return { ciphertext, kmsKeyId: "local-placeholder" };
}
