import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * ทะเบียนครัวเรือนที่ต้องเสียค่าเก็บขยะ (1 แถว = 1 ครัวเรือน) — ใช้ออกบิลประจำงวดและออก QR หน้าบ้าน
 * monthlyFee ว่าง = ใช้ราคากลางของ อบต. (organizations.metadata.payment.householdFee)
 */
@Entity('waste_households')
@Index(['organizationId', 'householdRef'], { unique: true })
export class WasteHousehold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'household_ref', type: 'varchar', length: 20 })
  householdRef: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 200 })
  holderName: string;

  @Column({ name: 'house_no', type: 'varchar', length: 20 })
  houseNo: string;

  @Column({ type: 'varchar', length: 5 })
  moo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'monthly_fee', type: 'numeric', precision: 10, scale: 2, nullable: true })
  monthlyFee: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
