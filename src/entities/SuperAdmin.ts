// entities/Superadmin.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './Role';

@Entity({ name: 'superadmins' })
export class Superadmin {
  @PrimaryGeneratedColumn('uuid', { name: 'superadmin_id' })
  superadminId!: string;

  @Column({ length: 255 })
  username!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ length: 255, nullable: true, name: 'first_name' })
  firstName?: string;

  @Column({ length: 255, nullable: true, name: 'last_name' })
  lastName?: string;
@Column({ type: "text", name: "phone_number", nullable: true })
  phoneNumber?: string | null;
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  // NEW: Many-to-One relation to Role (nullable so old rows remain valid)
  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;
}
