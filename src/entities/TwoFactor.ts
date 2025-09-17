// entities/TwoFactor.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "two_factor" })
export class TwoFactor {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  // actor: app_user.id OR 'superadmin' for tenant_account flow
  @Column({ type: "text", name: "user_id", nullable: true })
  @Index()
  userId!: string;

  // keep email but also allow phone_number for sms flows
  @Column({ type: "text", name: "email", nullable: true })
  @Index()
  email?: string | null;

  @Column({ type: "text", name: "phone_number", nullable: true })
  phoneNumber?: string | null;

  // old `code` (raw) will be migrated -> after migration you can drop this column
  // we keep it nullable for now so migration is safe
  @Column({ type: "text", name: "code", nullable: true })
  code?: string | null;

  // hashed code (sha256 hex) — used for verification
  @Column({ type: "varchar", length: 128, name: "code_hash", nullable: true })
  codeHash?: string | null;

  // generic channel: sms | email | otp | oauth | webauthn
  @Column({ type: "varchar", length: 20, name: "channel", default: "email" })
  channel!: string;

  // provider/subtype (e.g. "twilio", "ses", "magic-link")
  @Column({ type: "varchar", length: 50, name: "type", nullable: true })
  type?: string | null;

  // consumed boolean + timestamp (keep both for audit)
  @Column({ type: "boolean", name: "consumed", default: false })
  consumed!: boolean;

  @Column({ type: "timestamptz", name: "consumed_at", nullable: true })
  consumedAt?: Date | null;

  @Column({ type: "int", name: "attempts", default: 0 })
  attempts!: number;

  // purpose (login, password_reset, signup, etc.)
  @Column({ type: "text", name: "purpose", default: "login" })
  purpose!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamptz", name: "last_sent_at", default: () => "now()" })
  lastSentAt!: Date;

  // expiry column renamed to expires_at for clarity
  @Column({ type: "timestamptz", name: "expires_at", nullable: true })
  expiresAt?: Date | null;

  @Column({ type: "text", name: "clientId", nullable: true })
  clientId?: string | null; // null for superAdmin

  @Column({ type: "text", name: "role", nullable: true })
  role?: string | null; // snapshot for convenience

  @Column({ type: "text", name: "ip", nullable: true })
  ip?: string | null; // audit

  @Column({ type: "text", name: "user_agent", nullable: true })
  userAgent?: string | null; // audit

  // flexible JSON meta for provider snapshots (stored as string)
  @Column({ type: "text", name: "meta", nullable: true })
  meta?: string | null;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
