import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Client } from "./Client";

@Entity({ name: "payment_gateways" })
export class PaymentGateway {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "varchar", length: 100 })
  provider!: string; // e.g. Stripe, Razorpay

  @Column({ type: "varchar", length: 100 })
  merchantId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  webhookUrl?: string;
}
