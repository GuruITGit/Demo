import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Unique,
} from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { User } from './user.entity';

@Entity('approval_workflow_steps')
@Unique(['requestId', 'level'])
export class ApprovalWorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @ManyToOne(() => ApprovalRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: ApprovalRequest;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ name: 'level_name', length: 100 })
  levelName: string;

  @Column({ name: 'approver_id' })
  approverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ length: 30, default: 'รอดำเนินการ' })
  status: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ name: 'acted_at', type: 'timestamptz', nullable: true })
  actedAt: Date;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
