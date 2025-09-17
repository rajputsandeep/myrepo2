import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Client } from "./Client";
import { LicenseTypeMaster } from "./LicenseTypeMaster";

@Entity({ name: "license_allocations" })
export class LicenseAllocation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, (t) => t.licenseAllocations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "Client_id" })
  Client!: Client;

  @ManyToOne(() => LicenseTypeMaster, { eager: true })
  @JoinColumn({ name: "license_type_id" })
  licenseType!: LicenseTypeMaster;

  @Column({ type: "int", default: 0 })
  allocatedCount!: number;

  @Column({ type: "int", default: 0 })
  multiplier!: number;

  @Column({ type: "int", default: 0 })
  requestedCount!: number;

  @Column({ type: "int", default: 0 })
  usedCount!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  lastUpdated!: Date;
}