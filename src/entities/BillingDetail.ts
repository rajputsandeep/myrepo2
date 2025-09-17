// Filename: src/entities/BillingDetail.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './Client';

@Entity({ name: 'billing_details' })
export class BillingDetail {
  @PrimaryGeneratedColumn('uuid')
  billingId!: string;

  @ManyToOne(() => Client, (t) => t.billingDetails, { onDelete: 'CASCADE' })
  Client!: Client;

  @Index()
  @Column({ type: 'uuid' })
  ClientId!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  billingContactName?: string;

  @Column({ type: 'citext', nullable: true })
  billingEmail?: string;

  @Column({ type: 'text', nullable: true })
  billingAddress?: string;

  @Column({
    type: 'enum',
    enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL'],
    enumName: 'billing_cycle_t',
    default: 'MONTHLY',
  })
  billingCycle!: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

  @Column({ type: 'date', nullable: true })
  billingStartDate?: Date;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  billingCurrency!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  billingMethod?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  currentPlan?: string;

  @Column({ type: 'date', nullable: true })
  renewalDate?: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0.0 })
  outstandingBalance!: string;

  @Column({ type: 'date', nullable: true })
  lastPaymentDate?: Date;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'PENDING', 'OVERDUE'],
    enumName: 'payment_status_t',
    default: 'ACTIVE',
  })
  paymentStatus!: 'ACTIVE' | 'PENDING' | 'OVERDUE';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
