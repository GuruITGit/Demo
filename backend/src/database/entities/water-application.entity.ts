import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { WaterCustomer } from './water-customer.entity';

/**
 * แบบคำขอใช้น้ำ / สัญญาการใช้น้ำประปา — 1 ชุดต่อผู้ใช้น้ำ (แก้ไข/พิมพ์ซ้ำได้)
 * เลียนฟอร์มจากระบบเก่า (Prapa On Mobile หน้า /request) เพื่อออกเอกสารคำขอ + สัญญา
 * ข้อมูลตัวตน (ชื่อ/ที่อยู่/เลขบัตร/มิเตอร์) ดึงจากทะเบียนผู้ใช้น้ำ ส่วนนี้เก็บเฉพาะข้อมูลเฉพาะคำขอ
 */
@Entity('water_applications')
@Index(['organizationId', 'customerId'], { unique: true })
export class WaterApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => WaterCustomer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: WaterCustomer;

  /** อายุผู้ขอ (ปี) */
  @Column({ type: 'int', nullable: true })
  age: number;

  /** วันหมดอายุบัตรประชาชน */
  @Column({ name: 'id_expiry', type: 'date', nullable: true })
  idExpiry: string;

  @Column({ length: 120, nullable: true })
  occupation: string;

  @Column({ length: 200, nullable: true })
  workplace: string;

  /** ความประสงค์: ขอใช้น้ำใหม่ / ย้ายมิเตอร์ / เปลี่ยนขนาดมิเตอร์ / ยกเลิก ฯลฯ */
  @Column({ length: 120, nullable: true })
  purpose: string;

  /** ดำเนินการที่ (สถานที่ติดตั้ง) */
  @Column({ name: 'operate_at', length: 255, nullable: true })
  operateAt: string;

  /** สถานที่ใกล้เคียง (จุดสังเกต) */
  @Column({ length: 255, nullable: true })
  nearby: string;

  /** ขนาดท่อภายใน (นิ้ว) */
  @Column({ name: 'pipe_size', length: 20, nullable: true })
  pipeSize: string;

  /** ก๊อกน้ำขนาด (นิ้ว) */
  @Column({ name: 'faucet_size', length: 20, nullable: true })
  faucetSize: string;

  /** จำนวนก๊อก (ตัว) */
  @Column({ name: 'faucet_count', type: 'int', nullable: true })
  faucetCount: number;

  /** เงินประกันมาตร (บาท) — เก็บตอนทำสัญญา (ระบบเก่าแยกทะเบียนคุมยังไม่ได้ทำ) */
  @Column({ name: 'deposit_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  depositAmount: string;

  @Column({ name: 'receiver', length: 200, nullable: true })
  receiver: string;

  /** วันที่ลงคำขอ */
  @Column({ name: 'apply_date', type: 'date', nullable: true })
  applyDate: string;

  /** สถานะ: เสร็จ/จบงานแล้ว */
  @Column({ type: 'boolean', default: false })
  done: boolean;

  /** ผู้รับสัญญา (ชื่อและตำแหน่ง) */
  @Column({ name: 'contract_signer', length: 200, nullable: true })
  contractSigner: string;

  @Column({ name: 'witness1', length: 200, nullable: true })
  witness1: string;

  @Column({ name: 'witness2', length: 200, nullable: true })
  witness2: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
