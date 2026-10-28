import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('document_workflow_logs')
export class DocumentWorkflowLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'doc_type', length: 20 })
  docType: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'step_number', type: 'smallint' })
  stepNumber: number;

  @Column({ name: 'step_name', length: 100 })
  stepName: string;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ length: 50 })
  action: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'from_status', length: 50, nullable: true })
  fromStatus: string;

  @Column({ name: 'to_status', length: 50, nullable: true })
  toStatus: string;

  /** ภาพลายเซ็นที่วาดสดตอนลงนาม (base64 data URL) — กันการใช้ลายเซ็นพรีเซ็ตเก่า */
  @Column({ name: 'signature_image', type: 'text', nullable: true })
  signatureImage: string;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;
}
