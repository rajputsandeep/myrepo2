import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Client } from "./Client";

@Entity({ name: "crm_integrations" })
export class CrmIntegration {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "varchar", length: 100 })
  crmProvider!: string; // e.g. Salesforce, HubSpot

  @Column({ type: "varchar", length: 255 })
  instanceUrl!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  apiKeyClientId?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  authMethod?: string; // e.g. oauth2, apiKey
}
