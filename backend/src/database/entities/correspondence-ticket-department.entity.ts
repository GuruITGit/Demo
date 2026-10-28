import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { CorrespondenceTicket } from './correspondence-ticket.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

/** สถานะการดำเนินงานของแต่ละกองที่ถูกมอบหมายในสารบรรณ */
export enum TicketDeptStatus {
  ASSIGNED = 'รอดำเนินการ',
  IN_PROGRESS = 'กำลังดำเนินการ',
  SUBMITTED = 'ส่งแล้ว',
  RETURNED = 'ตีกลับ',
}

/**
 * การมอบหมายกองให้ดำเนินการในสารบรรณ (รองรับหลายกอง + เพิ่มกองภายหลังเมื่อนายกตีกลับ)
 * เก็บสถานะ/ลายเซ็นรับรองของแต่ละกองแยกกัน
 */
@Entity('correspondence_ticket_departments')
@Index('idx_ticket_dept_ticket', ['ticketId'])
@Index('idx_ticket_dept_dept', ['departmentId'])
export class CorrespondenceTicketDepartment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @ManyToOne(() => CorrespondenceTicket, (t) => t.ticketDepartments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: CorrespondenceTicket;

  @Column({ name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  /** ผู้รับผิดชอบหลักในกองนี้ (คนแรก — เก็บไว้เพื่อ compat/แจ้งเตือน) */
  @Column({ name: 'assigned_user_id', nullable: true })
  assignedUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User;

  /** ผู้รับผิดชอบในกองนี้ทั้งหมด (หลายคน — มอบหมายแบบ tree view) */
  @Column({ name: 'assigned_user_ids', type: 'jsonb', nullable: true })
  assignedUserIds: string[];

  /** ผู้รับผิดชอบทั้งหมด (resolve จาก assignedUserIds ตอนส่งออก — ไม่ใช่คอลัมน์จริง) */
  assignedUsers?: User[];

  @Column({
    type: 'varchar',
    length: 50,
    default: TicketDeptStatus.ASSIGNED,
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  /** ลายเซ็นรับรองของกอง */
  @Column({ name: 'signed_by', nullable: true })
  signedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'signed_by' })
  signer: User;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date;

  /** ปิดใช้งานการมอบหมาย (เก็บประวัติไว้แต่ไม่นับในรอบปัจจุบัน) */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
