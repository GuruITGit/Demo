import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/** ความลับระดับเจ้าของระบบ (ใช้ร่วมทุก อบต.) — อ่าน/เขียนผ่าน PlatformSecretsService เท่านั้น ห้ามส่ง value_enc ออก API */
@Entity('platform_secrets')
export class PlatformSecret {
  @PrimaryColumn({ length: 100 })
  key: string;

  @Column({ name: 'value_enc', type: 'text' })
  valueEnc: string;

  @Column({ length: 20, nullable: true })
  hint: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
