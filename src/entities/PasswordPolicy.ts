// entities/PasswordPolicy.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Client } from './Client';


@Entity({ name: 'password_policies' })
export class PasswordPolicy {
@PrimaryGeneratedColumn('uuid', { name: 'policy_id' })
policyId!: string;


@ManyToOne(() => Client, (c) => c.passwordPolicies, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'client_id' })
client!: Client;


@Column({ type: 'int', default: 12, name: 'minimum_length' })
minimumLength!: number;


@Column({ type: 'boolean', default: true, name: 'require_uppercase' })
requireUppercase!: boolean;


@Column({ type: 'boolean', default: true, name: 'require_lowercase' })
requireLowercase!: boolean;


@Column({ type: 'boolean', default: true, name: 'require_number' })
requireNumber!: boolean;


@Column({ type: 'boolean', default: true, name: 'require_special_char' })
requireSpecialChar!: boolean;


@Column({ type: 'int', default: 3, name: 'history_check_count' })
historyCheckCount!: number;


@Column({ type: 'int', default: 90, name: 'expiration_days' })
expirationDays!: number;


@Column({ type: 'int', default: 60, name: 'privileged_expiration_days' })
privilegedExpirationDays!: number;


@Column({ type: 'boolean', default: true, name: 'mfa_mandatory_for_admin' })
mfaMandatoryForAdmin!: boolean;


@CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
createdAt!: Date;


@UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
updatedAt!: Date;
}