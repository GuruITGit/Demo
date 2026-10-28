import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notification_preferences')
@Unique(['userId', 'notificationType'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'notification_type', length: 100 })
  notificationType: string;

  @Column({ name: 'via_in_app', default: true })
  viaInApp: boolean;

  @Column({ name: 'via_email', default: true })
  viaEmail: boolean;

  @Column({ name: 'via_line', default: false })
  viaLine: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
