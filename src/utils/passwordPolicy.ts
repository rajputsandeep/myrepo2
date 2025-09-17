// lib/passwordPolicy.ts
import zxcvbn from "zxcvbn";

export function validatePassword(password: string, opts: { username?: string, name?: string, company?: string } = {}) {
  if (typeof password !== "string") return { ok:false, reason: "password_required" };
  if (password.length < 12) return { ok:false, reason: "min_length" };
  if (!/[A-Z]/.test(password)) return { ok:false, reason: "uppercase_required" };
  if (!/[a-z]/.test(password)) return { ok:false, reason: "lowercase_required" };
  if (!/[0-9]/.test(password)) return { ok:false, reason: "number_required" };
  if (!/[!@#$%^&*_\-\+=]/.test(password)) return { ok:false, reason: "special_required" };

  const low = password.toLowerCase();
  if (opts.username && low.includes(opts.username.toLowerCase())) return { ok:false, reason: "contains_username" };
  if (opts.name && low.includes(opts.name.toLowerCase())) return { ok:false, reason: "contains_name" };
  if (opts.company && low.includes(opts.company.toLowerCase())) return { ok:false, reason: "contains_company" };

  // dictionary / weak check (use zxcvbn for stronger detection)
  const res = zxcvbn(password);
  if (res.score < 2) return { ok:false, reason: "weak_password" };

  return { ok:true };
}
