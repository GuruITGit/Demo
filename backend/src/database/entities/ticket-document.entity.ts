import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/** เอกสารที่ร่างใหม่ด้วยตัวแต่งเอกสาร ผูกกับเรื่องสารบรรณ (layout v2) */
@Entity('ticket_documents')
export class TicketDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'ticket_id', type: 'uuid' }) ticketId: string;
  @Column({ length: 200 }) title: string;
  @Column({ name: 'template_id', type: 'uuid', nullable: true }) templateId: string | null;
  @Column({ type: 'jsonb' }) layout: any;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'created_by' }) creator: User;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;
}
