import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalWorkflowStep } from './approval-workflow-step.entity';
import { User } from './user.entity';

@Entity('approval_workflow_logs')
export class ApprovalWorkflowLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @ManyToOne(() => ApprovalRequest)
  @JoinColumn({ name: 'request_id' })
  request: ApprovalRequest;

  @Column({ name: 'step_id', nullable: true })
  stepId: string;

  @ManyToOne(() => ApprovalWorkflowStep)
  @JoinColumn({ name: 'step_id' })
  step: ApprovalWorkflowStep;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ length: 30 })
  action: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ name: 'from_status', length: 50, nullable: true })
  fromStatus: string;

  @Column({ name: 'to_status', length: 50, nullable: true })
  toStatus: string;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;
}
