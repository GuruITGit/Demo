import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Department } from './department.entity';

/** เรื่องแจ้ง/ร้องเรียนจากประชาชน — กล่องรับเรื่องแยกจากสารบรรณ */
@Entity('citizen_reports')
export class CitizenReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'ref_no', length: 20, nullable: true })
  refNo: string;

  @Column({ length: 60 })
  category: string;

  // เอนจินฟอร์ม: คีย์ฟอร์ม + ชื่อฟอร์ม + คำตอบทุกฟิลด์ + ไฟล์แนบหลายช่อง + พิกัด
  @Column({ name: 'form_key', length: 60, nullable: true })
  formKey: string;

  @Column({ name: 'form_title', length: 200, nullable: true })
  formTitle: string;

  @Column({ type: 'jsonb', nullable: true })
  answers: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  files: { field: string; name: string; url: string }[];

  @Column({ type: 'jsonb', nullable: true })
  geo: { lat: number; lng: number };

  /** หมู่ที่ — ประชาชนเลือกเองตอนแจ้งเรื่อง (ตำบลนี้มี 13 หมู่ ไม่มีหมู่ 3) */
  @Column({ name: 'village_no', type: 'int', nullable: true })
  villageNo: number;

  @Column({ length: 200, nullable: true })
  title: string;

  /** เรื่อง (คำร้องทั่วไป) — admin แก้ไขได้ก่อนพิมพ์ PDF, ว่าง = fallback เป็นรายละเอียด 80 ตัวอักษรแรก */
  @Column({ length: 500, nullable: true })
  subject: string;

  /** admin เปิด "แก้ไขเอกสาร" ตรวจ/ยืนยันคำร้องทั่วไปแล้วอย่างน้อย 1 ครั้งเมื่อไหร่ — ใช้โชว์ติ๊กถูก */
  @Column({ name: 'petition_checked_at', type: 'timestamptz', nullable: true })
  petitionCheckedAt: Date;

  @Column({ type: 'text' })
  detail: string;

  @Column({ name: 'reporter_name', length: 150, nullable: true })
  reporterName: string;

  @Column({ name: 'reporter_phone', length: 30, nullable: true })
  reporterPhone: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string;

  // new | in_progress | done | rejected
  @Column({ length: 16, default: 'new' })
  status: string;

  @Column({ name: 'staff_note', type: 'text', nullable: true })
  staffNote: string;

  @Column({ name: 'handled_by', nullable: true })
  handledBy: string;

  // ─────────── ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) — คนละกลไกกับสารบรรณ ───────────
  /** กองที่ admin กลางเลือกส่งไป — ว่าง = ยังไม่ส่งไปกอง */
  @Column({ name: 'target_dept_id', nullable: true })
  targetDeptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'target_dept_id' })
  targetDept: Department;

  @Column({ name: 'dept_head_signed_by', nullable: true })
  deptHeadSignedBy: string;

  @Column({ name: 'dept_head_signed_at', type: 'timestamptz', nullable: true })
  deptHeadSignedAt: Date;

  /** รูปลายเซ็น (data URL base64) — อัปโหลดไม่บังคับตอนกดอนุมัติ */
  @Column({ name: 'dept_head_signature', type: 'text', nullable: true })
  deptHeadSignature: string;

  @Column({ name: 'clerk_signed_by', nullable: true })
  clerkSignedBy: string;

  @Column({ name: 'clerk_signed_at', type: 'timestamptz', nullable: true })
  clerkSignedAt: Date;

  @Column({ name: 'clerk_signature', type: 'text', nullable: true })
  clerkSignature: string;

  @Column({ name: 'mayor_signed_by', nullable: true })
  mayorSignedBy: string;

  @Column({ name: 'mayor_signed_at', type: 'timestamptz', nullable: true })
  mayorSignedAt: Date;

  @Column({ name: 'mayor_signature', type: 'text', nullable: true })
  mayorSignature: string;

  /** เอกสารที่เจ้าหน้าที่แต่ง (ตัวแต่งเอกสาร layout v2) — ทับบนเอกสารคำร้อง/รูปที่แนบ/หน้าเปล่า */
  @Column({ name: 'doc_layout', type: 'jsonb', nullable: true, select: false })
  docLayout: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
