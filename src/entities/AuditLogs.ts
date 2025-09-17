// entities/AuditLog.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Client } from './Client';
import { BaseAudit } from './BaseAudit';


@Entity({ name: 'audit_logs' })
export class AuditLog extends BaseAudit {
@PrimaryGeneratedColumn('uuid', { name: 'id' })
id!: string;


@Column({ length: 50, name: 'actor_type', nullable: true })
actorType?: string;


@Column({ type: 'uuid', name: 'actor_id', nullable: true })
actorId?: string;

@ManyToOne(() => Client, { nullable: true })
@JoinColumn({ name: 'client_id' })
client?: Client;


@Column({ length: 255, name: 'action' })
action!: string;


@Column({ length: 255, name: 'resource', nullable: true })
resource?: string;


@Column({ type: 'jsonb', nullable: true, name: 'meta' })
meta?: any;



}