// entities/Client.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Unique, Index } from 'typeorm';
import { User } from './User';
import { BaseAudit } from './BaseAudit';
import { BillingDetail } from './BillingDetail';
import { LicenseAllocation } from './LicenseAllocation';
import { ClientIntegration } from './ClientIntegration';


@Entity({ name: 'clients' })
@Unique(['email'])
@Unique(['username'])
export class Client extends BaseAudit {
 @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  tenantName!: string;

  @Index({ unique: true })
  @Column({ type: 'citext' })
  username?: string;

  @Column({ type: "text" })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  companyName!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  domain!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contactPerson?: string;

  @Index({ unique: true })
  @Column({ type: 'citext', name: 'email' })
  email?: string;

  @Column({ type: 'varchar', length: 50 })
  contactPhone?: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
    enumName: 'tenant_status_t',
    default: 'ACTIVE',
  })
  status!: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

  @Column({ type: "boolean", default: false }) // for checking user is logged in or not
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  encryptionKeyId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  databaseName?: string;

  @Column({ type: 'text', nullable: true })
  dbConnectionString?: string;

  @Column({ type: 'interval', nullable: true })
  dataRetention?: string;

  @Column({ type: 'boolean', default: false })
  complianceReceiptEnabled!: boolean;

  @Column({
    type: 'enum',
    enum: ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'],
    enumName: 'sla_tier_t',
    default: 'BASIC',
  })
  slaTier!: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

 
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  regAddress?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstNo?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registrationNo?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  panNo?: string;

  @OneToMany(() => LicenseAllocation, (la) => la.Client)
  licenseAllocations?: LicenseAllocation[];

@OneToMany(() => BillingDetail, (bd) => bd.Client)
billingDetails?: BillingDetail[]; 

@OneToMany(() => User, (u) => u.Client)
users?: User[];

@OneToMany(() => ClientIntegration, (ci) => ci.client)
integrations?: ClientIntegration[];


}