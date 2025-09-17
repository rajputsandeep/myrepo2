// src/entities/IntegrationSecret.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { ClientIntegration } from "./ClientIntegration";

@Entity({ name: "integration_secrets" })
export class IntegrationSecret {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => ClientIntegration, (ci) => ci.secrets, { onDelete: "CASCADE" })
  @JoinColumn({ name: "integration_id" })
  integration!: ClientIntegration;

  @Index()
  @Column()
  key!: string; // e.g. "apiKey", "clientSecret", "authToken", "smtpPassword"

  // store ciphertext only. Use KMS to decrypt at runtime.
  @Column({ type: "text" })
  encryptedValue!: string;

  // optional: which KMS key was used (string or arn)
  @Column({ nullable: true })
  kmsKeyId?: string;

  @Column({ type: "jsonb", nullable: true })
  meta?: Record<string, any>; // rotation, expiresAt, lastRotatedBy

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
