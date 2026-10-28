import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum DocumentUrgency {
  MOST_URGENT = 'ด่วนที่สุด',
  VERY_URGENT = 'ด่วนมาก',
  URGENT = 'ด่วน',
  NORMAL = 'ปกติ',
}

export enum IncomingDocStatus {
  PENDING = 'รอรับ',
  RECEIVED = 'รับแล้ว',
  REVIEWING = 'อยู่ระหว่างพิจารณา',
  WAITING_ORDER = 'รอสั่งการ',
  IN_PROGRESS = 'ดำเนินการ',
  COMPLETED = 'เสร็จสิ้น',
  CANCELLED = 'ยกเลิก',
}

@Entity('incoming_documents')
export class IncomingDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'receive_number', length: 50 })
  receiveNumber: string;

  @Column({ name: 'external_doc_number', length: 100, nullable: true })
  externalDocNumber: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ length: 500 })
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({
    name: 'urgency_level',
    type: 'varchar',
    length: 20,
    default: DocumentUrgency.NORMAL,
  })
  urgencyLevel: string;

  @Column({ name: 'sender_org', length: 300, nullable: true })
  senderOrg: string;

  @Column({ name: 'sender_name', length: 200, nullable: true })
  senderName: string;

  @Column({ name: 'receiver_dept_id', nullable: true })
  receiverDeptId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'receiver_dept_id' })
  receiverDept: Department;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_to' })
  assignedUser: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: IncomingDocStatus.PENDING,
  })
  status: string;

  @Column({ name: 'current_step', type: 'smallint', default: 1 })
  currentStep: number;

  @Column({ name: 'action_note', type: 'text', nullable: true })
  actionNote: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
