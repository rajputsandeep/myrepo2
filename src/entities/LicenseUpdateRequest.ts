import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Client } from "./Client";
import { User } from "./User";
import { LicenseUpdateApproval } from "./LicenseUpdateApproval";
import { LicenseUpdateAuditLog } from "./LicenseUpdateAuditLog";

export enum ResourceType {
  LICENSE = "license",
  CHANNEL = "channel",
  USER = "user",
}

export enum RequestType {
  INCREASE = "increase",
  DECREASE = "decrease",
}

export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

@Entity({ name: "license_update_requests" })
export class LicenseUpdateRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Reference to client
  @ManyToOne(() => Client, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "uuid", name: "client_id" })
  clientId!: string;

  @Column({ type: "varchar", length: 255, name: "client_name" })
  clientName!: string;

  @Column({ type: "enum", enum: ResourceType, name: "resource_type" })
  resourceType!: ResourceType;

  @Column({ type: "enum", enum: RequestType, name: "request_type" })
  requestType!: RequestType;

  @Column({ type: "int", name: "current_count" })
  currentCount!: number;

  @Column({ type: "int", name: "change_amount" })
  changeCount!: number;

  @Column({ type: "int", name: "new_total" })
  newTotal!: number;

  @Column({ type: "enum", enum: Priority, default: Priority.MEDIUM })
  priority!: Priority;

  @Column({ type: "text", name: "reason" })
  reason!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "sales_contact_id" })
  salesContact?: User | null;

  @Column({ type: "uuid", name: "sales_contact_id", nullable: true })
  salesContactId?: string | null;

  @Column({ type: "enum", enum: RequestStatus, default: RequestStatus.PENDING })
  status!: RequestStatus;

  @Column({ type: "text", name: "rejection_reason", nullable: true })
  rejectionReason?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => LicenseUpdateApproval, (a) => a.request)
  approvals?: LicenseUpdateApproval[];

  @OneToMany(() => LicenseUpdateAuditLog, (l) => l.request)
  auditLogs?: LicenseUpdateAuditLog[];
}
