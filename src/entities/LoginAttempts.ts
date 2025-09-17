// // Filename: src/entities/LoginAttempt.ts
// import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index, JoinColumn } from 'typeorm';
// import { User } from './User';
// import { DepartmentUser } from './DepartmentUser';

// @Entity({ name: 'login_attempts' })
// @Index(['email', 'createdAt'])
// export class LoginAttempt {
//   @PrimaryGeneratedColumn()
//   id!: number;

//   @ManyToOne(() => User, u => u.loginAttempts, { onDelete: 'SET NULL', nullable: true })
//   user?: User;
  
// @ManyToOne(() => DepartmentUser , d=> d.loginAttempts, { nullable: true, onDelete: "SET NULL" })
// @JoinColumn({ name: "department_user_id" })
// departmentUser?: DepartmentUser | null;

// @Column({ type: "uuid", name: "department_user_id", nullable: true })
// departmentUserId?: string | null;


//   @Column({ type: 'uuid', nullable: true })
//   userId?: string;

//   @Column({ type: 'citext', nullable: true })
//   email?: string;

//   @Column({ type: 'inet', nullable: true })
//   ipAddr?: string;

//   @Column({ type: 'text', nullable: true })
//   userAgent?: string;

//   @Column({ type: 'boolean' })
//   success!: boolean;

//   @Column({ type: 'text', nullable: true })
//   reason?: string;

//   @CreateDateColumn({ type: 'timestamptz' })
//   createdAt!: Date;
// }
// src/entities/LoginAttempts.ts  (showing relevant parts)
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { User } from "./User";
import { DepartmentUser } from "./DepartmentUser";

@Entity({ name: "login_attempts" })
export class LoginAttempt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // existing relation to normal users (nullable)
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User | null;

  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId?: string | null;

  // NEW: relation for department users
  @ManyToOne(() => DepartmentUser, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "department_user_id" })
  departmentUser?: DepartmentUser | null;

  @Column({ type: "uuid", name: "department_user_id", nullable: true })
  departmentUserId?: string | null;

  @Column({ type: "citext", nullable: true })
  email?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  ipAddr?: string | null;

  @Column({ type: "text", nullable: true })
  userAgent?: string | null;

  @Column({ type: "boolean", default: false })
  success!: boolean;

  @Column({ type: "text", nullable: true })
  reason?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
