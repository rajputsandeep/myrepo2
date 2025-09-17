// entities/RefreshToken.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { Client } from "./Client";
import { DepartmentUser } from "./DepartmentUser";

@Entity({ name: "refresh_tokens" })
@Index(["userType", "userId", "departmentUserId", "departmentUser"])
@Index(["email"])
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid", { name: "token_id" })
  tokenId!: string;

  @Column({ length: 50, name: "user_type" })
  userType!: string; // 'user' or 'superadmin'

  @ManyToOne(() => DepartmentUser, { nullable: true })
  @JoinColumn({ name: "department_user_id" })
  departmentUser?: DepartmentUser | null;

  @Column({ type: "uuid", name: "department_user_id", nullable: true })
  departmentUserId?: string | null;

  @Column({ type: "uuid", name: "user_id" })
  @Index('idx_refresh_tokens_user_id')
  userId!: string;

  @Column({ type: "citext", name: "email" })
  @Index('idx_refresh_tokens_email')
  email!: string; // 🔥 store email directly here

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: "client_id" })
  client?: Client;

  @Column({ type: "text", name: "token_hash" })
  @Index('idx_refresh_tokens_token_hash')
  tokenHash!: string;

  @Column({ type: "boolean", default: false, name: "revoked" })
  revoked!: boolean;

  @Column({ type: "uuid", nullable: true, name: "replaced_by_token_id" })
  replacedByTokenId?: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "expires_at" })
  expiresAt?: Date;
}

