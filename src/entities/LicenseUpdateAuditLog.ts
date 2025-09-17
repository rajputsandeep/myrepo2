import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { LicenseUpdateRequest } from "./LicenseUpdateRequest";
import { User } from "./User";

@Entity({ name: "license_update_audit_log" })
export class LicenseUpdateAuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => LicenseUpdateRequest, (r) => r.auditLogs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "request_id" })
  request!: LicenseUpdateRequest;

  @Column({ type: "uuid", name: "request_id" })
  requestId!: string;

  @Column({ type: "varchar", length: 30, name: "event_type", nullable: true })
  eventType?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "actor_id" })
  actor?: User | null;

  @Column({ type: "uuid", name: "actor_id", nullable: true })
  actorId?: string | null;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
