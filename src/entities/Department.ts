import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { DepartmentUser } from "./DepartmentUser";
import { DepartmentRole } from "./DepartmentRole";

@Entity({ name: "departments" })
export class Department {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 150 })
  name!: string; // e.g. Sales, Finance, TechDelivery, LeadGenerator, CEO

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @OneToMany(() => DepartmentUser, (du) => du.department)
  users?: DepartmentUser[];

  @OneToMany(() => DepartmentRole, (r) => r.department)
  roles?: DepartmentRole[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
