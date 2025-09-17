import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Client } from "./Client";

@Entity({ name: "social_media_integrations" })
export class SocialMediaIntegration {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "varchar", length: 100, nullable: true })
  facebookPageId?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  instagramBusinessId?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  linkedinPageId?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  twitterApiKey?: string;
}
