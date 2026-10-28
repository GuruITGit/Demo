import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from './user.entity';

@Entity('meeting_agenda_items')
export class MeetingAgendaItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'order_no', type: 'smallint' })
  orderNo: number;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'presenter_id', nullable: true })
  presenterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'presenter_id' })
  presenter: User;

  @Column({ name: 'duration_min', type: 'smallint', nullable: true })
  durationMin: number;

  @Column({ length: 50, default: 'แจ้งเพื่อทราบ' })
  type: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
