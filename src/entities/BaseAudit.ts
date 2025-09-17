// entities/BaseAudit.ts
import { Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export abstract class BaseAudit {
  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "uuid", name: "created_by_id", nullable: true })
  createdById?: string | null;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @Column({ type: "uuid", name: "updated_by_id", nullable: true })
  updatedById?: string | null;


}
