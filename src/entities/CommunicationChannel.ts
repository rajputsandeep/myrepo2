import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Client } from "./Client";

@Entity({ name: "communication_channels" })
export class CommunicationChannel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Client, { onDelete: "CASCADE" })
  @JoinColumn({ name: "client_id" })
  client!: Client;

  @Column({ type: "varchar", length: 100, nullable: true })
  whatsappProvider?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  whatsappBusinessNumber?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  smsGateway?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  smsSenderId?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  emailProvider?: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  emailFromAddress?: string;
}
