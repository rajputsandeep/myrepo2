import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RolePermission } from './RolePermission';

@Entity({ name: 'permissions' })
export class Permission {
  @PrimaryGeneratedColumn('uuid', { name: 'permission_id' })
  permissionId!: string;

  @Column({ length: 255, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // explicit join entity -> rolePermissions
  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions?: RolePermission[];
}
