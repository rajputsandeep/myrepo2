// src/entities/LicenseApprovalLevel.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Client } from "./Client";

@Entity({ name: "license_approval_levels" })
export class LicenseApprovalLevel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Index()
  @Column({ type: "uuid", name: "client_id" })
  clientId!: string;

  // order of this step (1 = first approver)
  @Column({ type: "int", name: "step_order" })
  stepOrder!: number;

  @Column({ type: "varchar", length: 150, name: "department_name" })
  departmentName!: string;

  // optional: map to ApprovalStage if you want to use enum
  @Column({ type: "varchar", length: 50, name: "approval_stage", nullable: true })
  approvalStage?: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
