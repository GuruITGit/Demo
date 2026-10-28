import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('system_settings')
@Unique(['organizationId', 'key'])
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ length: 200 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ name: 'value_json', type: 'jsonb', nullable: true })
  valueJson: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater: User;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
