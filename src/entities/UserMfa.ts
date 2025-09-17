// src/entities/UserMfa.ts
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
import { User } from "./User";

@Entity({ name: "user_mfa" })
export class UserMfa {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (u) => u.mfas, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Index()
  @Column({ type: "uuid" })
  userId!: string;

  // For now only 'email' is used. Keep enum for future extension.
  @Column({ type: "enum", enum: ["email", "totp", "sms"], default: "email" })
  mfaType!: "email" | "totp" | "sms";

  // if true => user-level MFA is turned ON (client must also be permitted)
  @Column({ type: "boolean", default: false })
  enabled!: boolean;

  // secret used for TOTP (encrypted in prod). not used for email OTP.
  @Column({ type: "text", nullable: true })
  secret?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
