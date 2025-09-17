// src/entities/ClientIntegration.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from "typeorm";
import { Client } from "./Client";
import { IntegrationSecret } from "./IntegrationSecret";
import { IntegrationWebhook } from "./IntegrationWebhook";

export type IntegrationType =
  | "CRM"
  | "WHATSAPP"
  | "SMS"
  | "EMAIL"
  | "SOCIAL"
  | "PAYMENT"
  | "CUSTOM";

@Entity({ name: "client_integrations" })
@Unique(["client", "type", "provider", "name"])
export class ClientIntegration {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, (c) => c.integrations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Index()
  @Column({ type: "enum", enum: ["CRM", "WHATSAPP", "SMS", "EMAIL", "SOCIAL", "PAYMENT", "CUSTOM"] })
  type!: IntegrationType;

  @Index()
  @Column({ type: "varchar", length: 100 })
  provider!: string; // provider key: "salesforce", "meta_cloud", "twilio", "stripe", "smtp"

  @Column({ type: "varchar", length: 150, nullable: true })
  name?: string; // friendly name for this instance

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  // Non-sensitive provider config (URLs, sender IDs, page IDs etc.)
  @Column({ type: "jsonb", nullable: true })
  config?: Record<string, any>;

  // One-to-many pointer to encrypted secrets (stored separately)
  @OneToMany(() => IntegrationSecret, (s) => s.integration, { cascade: true })
  secrets?: IntegrationSecret[];

  // Optional webhook rows
  @OneToMany(() => IntegrationWebhook, (w) => w.integration, { cascade: true })
  webhooks?: IntegrationWebhook[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
