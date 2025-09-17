// src/entities/IntegrationWebhook.ts
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

@Entity({ name: "integration_webhooks" })
export class IntegrationWebhook {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => ClientIntegration, (ci) => ci.webhooks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "integration_id" })
  integration!: ClientIntegration;

  @Column({ type: "varchar", length: 1024 })
  url!: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  // encrypted verification token stored in integration_secrets is preferable; use meta for non-sensitive info
  @Column({ type: "jsonb", nullable: true })
  meta?: Record<string, any>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
