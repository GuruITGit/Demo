import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, Unique,
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from './user.entity';

@Entity('meeting_attendees')
@Unique(['meetingId', 'userId'])
export class MeetingAttendee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 50, default: 'ผู้เข้าร่วม' })
  role: string;

  @Column({ name: 'is_confirmed', default: false })
  isConfirmed: boolean;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'is_attended', type: 'boolean', nullable: true })
  isAttended: boolean;

  @Column({ name: 'attended_at', type: 'timestamptz', nullable: true })
  attendedAt: Date;

  @Column({ name: 'invite_sent_at', type: 'timestamptz', nullable: true })
  inviteSentAt: Date;

  @Column({ type: 'text', nullable: true })
  note: string;
}
