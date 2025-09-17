// src/entities/ClientMfaPolicy.ts
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
import { Client } from "./Client";

@Entity({ name: "client_mfa_policy" })

export class ClientMfaPolicy {
  
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Index()
  @Column({ type: "uuid" })
  clientId!: string;

  // role name (string) — store lowercase names to simplify queries.
  @Column({ type: "varchar", length: 150 })
  roleName!: string;

  // whether MFA is required by default for this role
  @Column({ type: "boolean", default: false })
  mfaRequired!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
