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
import { DepartmentUser } from "./DepartmentUser";
import { DepartmentRole } from "./DepartmentRole";

@Entity({ name: "department_user_roles" })
export class DepartmentUserRole {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => DepartmentUser, (u) => u.roleMappings, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: DepartmentUser;

  @Index()
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => DepartmentRole, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: DepartmentRole;

  @Index()
  @Column({ type: "uuid", name: "role_id" })
  roleId!: string;

  @Column({ type: "boolean", default: false })
  primaryRole!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
