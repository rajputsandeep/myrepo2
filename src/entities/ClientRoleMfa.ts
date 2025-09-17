// src/entities/ClientRoleMfa.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Client } from "./Client";
import { Role } from "./Role";

@Entity({ name: "client_role_mfa" })

export class ClientRoleMfa {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "uuid" })
  @Index()
  clientId!: string;

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @Index()
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column({ type: "uuid" })
  roleId!: string;

  @Column({ type: "boolean", default: false })
  mfaRequired!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
