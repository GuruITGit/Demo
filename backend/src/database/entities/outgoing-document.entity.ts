import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { User } from './user.entity';
import { IncomingDocument } from './incoming-document.entity';

export enum OutgoingDocStatus {
  DRAFT = 'ร่าง',
  WAITING_SIGN = 'รอเซ็น',
  SIGNED = 'เซ็นแล้ว',
  SENT = 'ส่งแล้ว',
  CANCELLED = 'ยกเลิก',
}

@Entity('outgoing_documents')
export class OutgoingDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'doc_number', length: 50 })
  docNumber: string;

  @Column({ name: 'doc_date', type: 'date' })
  docDate: Date;

  @Column({ length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'urgency_level', length: 20, default: 'ปกติ' })
  urgencyLevel: string;

  @Column({ name: 'recipient_name', length: 300 })
  recipientName: string;

  @Column({ name: 'recipient_org', length: 300, nullable: true })
  recipientOrg: string;

  @Column({ name: 'recipient_address', type: 'text', nullable: true })
  recipientAddress: string;

  @Column({ name: 'signer_id', nullable: true })
  signerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'signer_id' })
  signer: User;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date;

  @Column({ name: 'pdf_url', length: 500, nullable: true })
  pdfUrl: string;

  @Column({ type: 'varchar', length: 50, default: OutgoingDocStatus.DRAFT })
  status: string;

  @Column({ name: 'reply_to_id', nullable: true })
  replyToId: string;

  @ManyToOne(() => IncomingDocument)
  @JoinColumn({ name: 'reply_to_id' })
  replyTo: IncomingDocument;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

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
