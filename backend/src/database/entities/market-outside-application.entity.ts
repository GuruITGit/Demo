import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
import { MarketOutsideLocation } from './market-outside.entity';

/** ใบสมัครแผงลอยจากประชาชน — อนุมัติแล้วออกบิลค่าเช่า (รหัส app_code ใช้ค้นและชำระ) */
@Entity('market_outside_applications')
@Index(['organizationId', 'appCode'], { unique: true })
export class MarketOutsideApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => MarketOutsideLocation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: MarketOutsideLocation;

  /** รหัสใบสมัคร เช่น OUT-0001 */
  @Column({ name: 'app_code', type: 'varchar', length: 12 })
  appCode: string;

  @Column({ name: 'applicant_name', type: 'varchar', length: 200 })
  applicantName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'id_card_url', type: 'text', nullable: true })
  idCardUrl: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'int', default: 1 })
  days: number;

  /** regular = ประจำ (จ่ายทีหลังได้) · temporary = ชั่วคราว (จ่ายทันที) */
  @Column({ name: 'tenancy_type', type: 'varchar', length: 12, default: 'regular' })
  tenancyType: 'regular' | 'temporary';

  /** pending = รอตรวจ · approved = อนุมัติแล้ว (มีบิล) · rejected = ไม่อนุมัติ */
  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: string;

  @Column({ name: 'review_note', type: 'varchar', length: 300, nullable: true })
  reviewNote: string | null;

  @Column({ name: 'bill_id', type: 'uuid', nullable: true })
  billId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
