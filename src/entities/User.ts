// src/entities/User.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Client } from "./Client";
import { Role } from "./Role";
import { LoginAttempt } from "./LoginAttempts";
import { UserMfa } from "./UserMfa";
import { BaseAudit } from "./BaseAudit";

@Entity({ name: "users" })
export class User extends BaseAudit{
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Index({ unique: true })
  @Column({ type: 'citext', nullable: true })
  username?: string;

  // exclude password by default when selecting
  @Column({ type: "text", select: false })
  passwordHash!: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  mobile?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  displayName?: string;

  @ManyToOne(() => Client, (t) => t.users, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  Client!: Client;

  @ManyToOne(() => Role, { nullable: false })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @OneToMany(() => LoginAttempt, (la) => la.user)
  loginAttempts?: LoginAttempt[];

  @Column({
    type: "enum",
    enum: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
    default: "ACTIVE",
  })
  status!: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

  @Column({ type: "int", default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: "timestamptz", nullable: true })
  lockedAt?: Date | null;

  @Column({ type: "boolean", default: false })
  isActive!: boolean;

  @Column({ type: "boolean", default: true })
  isTemporaryPassword!: boolean;

  @OneToMany(() => UserMfa, (mfa) => mfa.user)
  mfas!: UserMfa[];


}
