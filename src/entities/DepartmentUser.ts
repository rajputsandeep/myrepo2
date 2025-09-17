// src/entities/DepartmentUser.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Department } from "./Department";
import { DepartmentUserRole } from "./DepartmentUserRole";
import { LoginAttempt } from "./LoginAttempts";

@Entity({ name: "department_users" })
export class DepartmentUser {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Department, (d) => d.users, { onDelete: "CASCADE" })
  @JoinColumn({ name: "department_id" })
  department!: Department;

  @Index()
  @Column({ type: "uuid", name: "department_id" })
  departmentId!: string;

  @Column({ type: "varchar", length: 255 })
  fullname!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length:255, name: 'email' })
  email?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  mobile?: string | null;


  @Column({ type: "text" })
  passwordHash?: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt?: Date | null;

  @ManyToOne(() => DepartmentUser, (u) => u.directReports, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "manager_id" })
  manager?: DepartmentUser | null;

  @Column({ type: "uuid", name: "manager_id", nullable: true })
  managerId?: string | null;

  @Column({ type: "boolean", default: false })
  isHead!: boolean; // HOD flag

  @OneToMany(() => LoginAttempt, (la) => la.user)
  loginAttempts?: LoginAttempt[];

  @Column({
    type: "enum",
    enum: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
    default: "ACTIVE",
  })
  status!: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";


  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  // relations
  @OneToMany(() => DepartmentUser, (u) => u.manager)
  directReports?: DepartmentUser[];

  // <-- IMPORTANT: roleMappings relation required by DepartmentUserRole
  @OneToMany(() => DepartmentUserRole, (dur) => dur.user)
  roleMappings?: DepartmentUserRole[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
