import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('welfare_recipients')
export class WelfareRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'recipient_number', length: 50 })
  recipientNumber: string;

  /** ประเภท: ผู้สูงอายุ, ผู้พิการ, ผู้ป่วยเอดส์ */
  @Column({ name: 'welfare_type', length: 100 })
  welfareType: string;

  @Column({ name: 'id_card', length: 20 })
  idCard: string;

  @Column({ name: 'prefix', length: 20, nullable: true })
  prefix: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({ name: 'phone', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'village', length: 200, nullable: true })
  village: string;

  @Column({ name: 'monthly_allowance', type: 'numeric', precision: 10, scale: 2, default: 0 })
  monthlyAllowance: number;

  @Column({ name: 'payment_method', length: 50, default: 'โอนเงิน' })
  paymentMethod: string;

  @Column({ name: 'bank_name', length: 100, nullable: true })
  bankName: string;

  @Column({ name: 'bank_account', length: 30, nullable: true })
  bankAccount: string;

  @Column({ name: 'register_date', type: 'date' })
  registerDate: Date;

  @Column({ name: 'disability_type', length: 200, nullable: true })
  disabilityType: string;

  @Column({ name: 'disability_card', length: 50, nullable: true })
  disabilityCard: string;

  @Column({ length: 50, default: 'ใช้งาน' })
  status: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string;

  @Column({ name: 'registered_by', nullable: true })
  registeredById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'registered_by' })
  registeredBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
