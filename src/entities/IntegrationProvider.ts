// src/entities/IntegrationProvider.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity({ name: "integration_providers" })
export class IntegrationProvider {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  key!: string; // e.g. "twilio", "meta_cloud", "salesforce", "stripe", "smtp"

  @Column()
  displayName!: string; // e.g. "Twilio"

  // provider capabilities (required fields, secret keys, types) for UI & validation
  @Column({ type: "jsonb", nullable: true })
  capabilities?: Record<string, any>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
