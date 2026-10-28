import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { MeetingAgendaItem } from './meeting-agenda-item.entity';
import { User } from './user.entity';

@Entity('meeting_resolutions')
export class MeetingResolution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => Meeting)
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'agenda_item_id', nullable: true })
  agendaItemId: string;

  @ManyToOne(() => MeetingAgendaItem)
  @JoinColumn({ name: 'agenda_item_id' })
  agendaItem: MeetingAgendaItem;

  @Column({ name: 'order_no', type: 'smallint' })
  orderNo: number;

  @Column({ name: 'resolution_text', type: 'text' })
  resolutionText: string;

  @Column({ name: 'responsible_id', nullable: true })
  responsibleId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'responsible_id' })
  responsible: User;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ length: 30, default: 'รอดำเนินการ' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
