import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { LicenseUpdateRequest } from "./LicenseUpdateRequest";
import { User } from "./User";

export enum ApprovalStage {
  SALES = "sales",
  FINANCE = "finance",
  CEO = "ceo",
}

export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

export enum Decision {
  APPROVED = "approved",
  REJECTED = "rejected",
  PENDING = "pending",
}

@Entity({ name: "license_update_approvals" })
export class LicenseUpdateApproval {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => LicenseUpdateRequest, (r) => r.approvals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "request_id" })
  request!: LicenseUpdateRequest;

  @Column({ type: "uuid", name: "request_id" })
  requestId!: string;

  @Column({ type: "enum", enum: ApprovalStage, name: "approval_stage" })
  approvalStage!: ApprovalStage;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "approved_by" })
  approvedBy?: User | null;

  @Column({ type: "uuid", name: "approved_by", nullable: true })
  approvedById?: string | null;

  @Column({ type: "enum", enum: Decision, default: Decision.PENDING })
  decision!: Decision;
  @Column({ type: "enum", enum: RequestStatus, default: RequestStatus.PENDING })
  status!: RequestStatus;

  @Column({ type: "text", nullable: true })
  comments?: string | null;

  @Column({ type: "timestamptz", name: "decided_at", nullable: true })
  decidedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
