import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Complaint } from './complaint.entity';
import { User } from './user.entity';

@Entity('complaint_workflow_logs')
export class ComplaintWorkflowLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'complaint_id' })
  complaintId: string;

  @ManyToOne(() => Complaint)
  @JoinColumn({ name: 'complaint_id' })
  complaint: Complaint;

  @Column({ name: 'actor_id', nullable: true })
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

  @Column({ name: 'is_visible_to_public', default: true })
  isVisibleToPublic: boolean;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;
}
