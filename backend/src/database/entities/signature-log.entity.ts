import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { UserSignature } from './user-signature.entity';

@Entity('signature_logs')
export class SignatureLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'signature_id' })
  signatureId: string;

  @ManyToOne(() => UserSignature)
  @JoinColumn({ name: 'signature_id' })
  signature: UserSignature;

  @Column({ name: 'document_type', length: 50 })
  documentType: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'document_title', length: 500, nullable: true })
  documentTitle: string;

  @CreateDateColumn({ name: 'signed_at' })
  signedAt: Date;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ length: 200, nullable: true })
  browser: string;

  @Column({ name: 'device_type', length: 50, nullable: true })
  deviceType: string;

  @Column({ length: 100, nullable: true })
  os: string;

  @Column({ name: 'page_number', type: 'smallint', nullable: true })
  pageNumber: number;

  @Column({ name: 'position_x', type: 'real', nullable: true })
  positionX: number;

  @Column({ name: 'position_y', type: 'real', nullable: true })
  positionY: number;

  @Column({ type: 'real', nullable: true })
  width: number;

  @Column({ type: 'real', nullable: true })
  height: number;

  @Column({ name: 'document_hash', length: 64, nullable: true })
  documentHash: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;
}
