import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { LeaveRequest } from './leave-request.entity';
import { User } from './user.entity';

@Entity('leave_approval_logs')
export class LeaveApprovalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @ManyToOne(() => LeaveRequest)
  @JoinColumn({ name: 'request_id' })
  request: LeaveRequest;

  @Column({ name: 'approver_id' })
  approverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ type: 'smallint' })
  level: number;

  @Column({ name: 'level_name', length: 100, nullable: true })
  levelName: string;

  @Column({ length: 30 })
  action: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'acted_at' })
  actedAt: Date;
}
