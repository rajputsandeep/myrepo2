import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { BaseAudit } from "./BaseAudit";
import { RolePermission } from "./RolePermission";
import { User } from "./User";
import { Client } from "./Client";

@Entity({ name: "roles" })
@Index(["name", "client"], { unique: true })
export class Role extends BaseAudit {
  @PrimaryGeneratedColumn("uuid", { name: "role_id" })
  roleId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  // client scope: null => global role
  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: "client_id" })
  client?: Client | null;

  @Column({ type: "boolean", name: "is_global", default: true })
  isGlobal!: boolean;

  // explicit join entity -> rolePermissions
  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions?: RolePermission[];

  @OneToMany(() => User, (u) => u.role)
  users?: User[];
}
