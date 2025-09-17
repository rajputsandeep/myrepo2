import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Client } from "./Client";

@Entity({ name: "custom_integrations" })
export class CustomIntegration {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "varchar", length: 100 })
  integrationName!: string;

  @Column({ type: "varchar", length: 255 })
  baseUrl!: string;

  @Column({ type: "varchar", length: 50 })
  authType!: string; // e.g. apiKey, oauth2

  @Column({ type: "varchar", length: 255, nullable: true })
  apiKeyToken?: string;
}
