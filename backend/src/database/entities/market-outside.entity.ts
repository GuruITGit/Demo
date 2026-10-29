import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** จุดแผงลอย (นอกผังแผงประจำ) เช่น หน้าตลาด/ลานจอดรถ — เก็บค่าที่รายวันหรือรายเดือน · enabled = เปิดให้เก็บ/จอง */
@Entity('market_outside_locations')
@Index(['organizationId'])
export class MarketOutsideLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'rent_rate', type: 'numeric', precision: 10, scale: 2, default: 0 })
  rentRate: string;

  /** daily | monthly */
  @Column({ name: 'rent_period', type: 'varchar', length: 8, default: 'daily' })
  rentPeriod: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** false = ลบแล้ว (เก็บประวัติรายการเก็บเงินไว้) */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** รายการเก็บค่าที่แผงลอย (เจ้าหน้าที่บันทึกเมื่อเก็บเงินหน้างาน) */
@Entity('market_outside_collections')
@Index(['organizationId', 'locationId', 'collectedOn'])
export class MarketOutsideCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'vendor_name', type: 'varchar', length: 200 })
  vendorName: string;

  @Column({ name: 'collected_on', type: 'date' })
  collectedOn: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ name: 'receipt_no', type: 'varchar', length: 30, nullable: true })
  receiptNo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
