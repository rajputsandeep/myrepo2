import {
  Entity,
  ManyToOne,
  PrimaryColumn,
  JoinColumn,
  Column,
} from "typeorm";
import { Role } from "./Role";
import { Permission } from "./Permission";

@Entity({ name: "role_permissions" })
export class RolePermission {
  @PrimaryColumn({ type: "uuid", name: "role_id" })
  roleId!: string;

  @PrimaryColumn({ type: "uuid", name: "permission_id" })
  permissionId!: string;

  @ManyToOne(() => Role, (r) => r.rolePermissions, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Permission, (p) => p.rolePermissions, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "permission_id" })
  permission!: Permission;

  // optional: a lightweight helper column or audit columns can go here if you want
  // @Column({ type: 'timestamptz', default: () => 'now()' })
  // createdAt!: Date;
}
