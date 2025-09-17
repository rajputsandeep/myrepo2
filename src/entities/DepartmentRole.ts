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
import { Department } from "./Department";

@Entity({ name: "department_roles" })
export class DepartmentRole {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Department, (d) => d.roles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "department_id" })
  department!: Department;

  @Index()
  @Column({ type: "uuid", name: "department_id" })
  departmentId!: string;

  @Column({ type: "varchar", length: 150 })
  name!: string; // e.g. "Manager", "Lead", "Executive", "Analyst"

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ type: "boolean", default: false })
  isDefaultForHead?: boolean; // optional flag if this role is commonly used as head role

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
