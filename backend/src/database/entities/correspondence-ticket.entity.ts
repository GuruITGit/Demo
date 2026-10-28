import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique, Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { User } from './user.entity';
import { CorrespondenceTicketDepartment } from './correspondence-ticket-department.entity';

/** ระดับความเร่งด่วน (แสดงสีชัดเจนใน UI) */
export enum TicketUrgency {
  NORMAL = 'ปกติ',
  URGENT = 'ด่วน',
  VERY_URGENT = 'ด่วนมาก',
  MOST_URGENT = 'ด่วนที่สุด',
}

/** ชั้นความลับของหนังสือ (ใช้จำกัดสิทธิ์การเข้าถึง — เรียงระดับจากน้อยไปมาก) */
export enum TicketConfidentiality {
  NORMAL = 'ปกติ',
  CONFIDENTIAL = 'ลับ',
  SECRET = 'ลับมาก',
  TOP_SECRET = 'ลับที่สุด',
}

/** ลำดับชั้นความลับ (0 = เปิดเผยได้, ยิ่งสูงยิ่งจำกัด) */
export const CONFIDENTIALITY_RANK: Record<string, number> = {
  'ปกติ': 0,
  'ลับ': 1,
  'ลับมาก': 2,
  'ลับที่สุด': 3,
};

/** วัตถุประสงค์ของหนังสือ */
export enum TicketPurpose {
  ACKNOWLEDGE = 'เพื่อทราบ',
  CONSIDER = 'เพื่อพิจารณา',
  APPROVE = 'เพื่ออนุมัติ',
  PROCEED = 'เพื่อดำเนินการ',
  COORDINATE = 'เพื่อประสานงาน',
  REPORT = 'เพื่อรายงานผล',
  OTHER = 'อื่นๆ',
}

/** ทิศทางของหนังสือในสมุดทะเบียน */
export enum TicketDirection {
  RECEIVE = 'รับ',
  SEND = 'ส่ง',
}

/**
 * สมุดทะเบียน (Register Book) — แต่ละเล่มมีเลขรันแยกอิสระต่อปี ตามระเบียบงานสารบรรณ
 * อ้างอิงระบบจริง brmsarabanflow (typeRunning) ดู docs/brm-rework-spec.md §A
 */
export enum RegisterBook {
  // ── ทะเบียนรับ ──
  R_MAIN = 'R_MAIN',           // รับทั่วไป
  R_SECRET = 'R_SECRET',       // รับความลับ
  R_MSG_MEMO = 'R_MSG_MEMO',   // รับบันทึกข้อความ
  R_COMPLAIN = 'R_COMPLAIN',   // รับร้องทุกข์/ร้องเรียน
  // ── ทะเบียนส่ง ──
  S_NORMAL = 'S_NORMAL',                 // ส่งทั่วไป
  S_VIAN = 'S_VIAN',                     // ส่งเวียน
  S_SECRET = 'S_SECRET',                 // ส่งความลับ
  S_MSG_MEMO_NORMAL = 'S_MSG_MEMO_NORMAL', // ส่งบันทึกข้อความทั่วไป
  S_MSG_MEMO_VIAN = 'S_MSG_MEMO_VIAN',   // ส่งบันทึกข้อความเวียน
  S_DIRECTION = 'S_DIRECTION',           // คำสั่ง
  S_ANNOUNCE = 'S_ANNOUNCE',             // ประกาศ
  S_GUARANTEE = 'S_GUARANTEE',           // หนังสือรับรอง
}

export interface RegisterBookMeta {
  key: RegisterBook;
  label: string;
  direction: TicketDirection;
  /** อักษร/คำนำหน้าเฉพาะเล่ม (ต่อจาก prefix กอง) เช่น 'ว' สำหรับเวียน */
  bookCode?: string;
  /** เล่มเวียน — รองรับผู้รับหลายราย/จองเลขช่วง */
  circular?: boolean;
  /** เล่มความลับ — ตั้ง confidentiality เริ่มต้น >= ลับ */
  secret?: boolean;
  /** รูปแบบเลข: 'dept' = prefixกอง+running, 'titled' = คำนำหน้า+running/ปี (คำสั่ง/ประกาศ/รับรอง) */
  numberStyle: 'dept' | 'titled';
  /** คำนำหน้าเลขแบบ titled เช่น 'คำสั่งที่' 'ประกาศที่' */
  titlePrefix?: string;
}

/** เมตาดาทาของแต่ละสมุดทะเบียน — ใช้สร้างเลข + render UI */
export const REGISTER_BOOKS: Record<RegisterBook, RegisterBookMeta> = {
  [RegisterBook.R_MAIN]:      { key: RegisterBook.R_MAIN,      label: 'สมุดทะเบียนรับทั่วไป',            direction: TicketDirection.RECEIVE, numberStyle: 'dept' },
  [RegisterBook.R_SECRET]:    { key: RegisterBook.R_SECRET,    label: 'สมุดทะเบียนรับความลับ',           direction: TicketDirection.RECEIVE, numberStyle: 'dept', secret: true },
  [RegisterBook.R_MSG_MEMO]:  { key: RegisterBook.R_MSG_MEMO,  label: 'สมุดทะเบียนรับบันทึกข้อความ',      direction: TicketDirection.RECEIVE, numberStyle: 'dept' },
  [RegisterBook.R_COMPLAIN]:  { key: RegisterBook.R_COMPLAIN,  label: 'สมุดทะเบียนรับร้องทุกข์',          direction: TicketDirection.RECEIVE, numberStyle: 'dept' },
  [RegisterBook.S_NORMAL]:    { key: RegisterBook.S_NORMAL,    label: 'สมุดทะเบียนส่งทั่วไป',            direction: TicketDirection.SEND, numberStyle: 'dept' },
  [RegisterBook.S_VIAN]:      { key: RegisterBook.S_VIAN,      label: 'สมุดทะเบียนส่งเวียน',             direction: TicketDirection.SEND, numberStyle: 'dept', bookCode: 'ว', circular: true },
  [RegisterBook.S_SECRET]:    { key: RegisterBook.S_SECRET,    label: 'สมุดทะเบียนส่งความลับ',           direction: TicketDirection.SEND, numberStyle: 'dept', secret: true },
  [RegisterBook.S_MSG_MEMO_NORMAL]: { key: RegisterBook.S_MSG_MEMO_NORMAL, label: 'สมุดทะเบียนส่งบันทึกข้อความทั่วไป', direction: TicketDirection.SEND, numberStyle: 'dept' },
  [RegisterBook.S_MSG_MEMO_VIAN]:   { key: RegisterBook.S_MSG_MEMO_VIAN,   label: 'สมุดทะเบียนส่งบันทึกข้อความเวียน',  direction: TicketDirection.SEND, numberStyle: 'dept', bookCode: 'ว', circular: true },
  [RegisterBook.S_DIRECTION]: { key: RegisterBook.S_DIRECTION, label: 'สมุดทะเบียนคำสั่ง',               direction: TicketDirection.SEND, numberStyle: 'titled', titlePrefix: 'คำสั่งที่' },
  [RegisterBook.S_ANNOUNCE]:  { key: RegisterBook.S_ANNOUNCE,  label: 'สมุดทะเบียนประกาศ',               direction: TicketDirection.SEND, numberStyle: 'titled', titlePrefix: 'ประกาศที่' },
  [RegisterBook.S_GUARANTEE]: { key: RegisterBook.S_GUARANTEE, label: 'สมุดทะเบียนหนังสือรับรอง',        direction: TicketDirection.SEND, numberStyle: 'titled', titlePrefix: 'หนังสือรับรองที่' },
};

/** รายการ "สิ่งที่ส่งมาด้วย" (เก็บเป็น jsonb หลายรายการ) */
export interface TicketEnclosure {
  name: string;
  qty?: string;
  unit?: string;
}

/**
 * สถานะหลักของสารบรรณ (ขับเคลื่อน workflow และปุ่มกรองใน Dashboard)
 *  รอดำเนินการ      = มอบหมายกองแล้ว แต่กองยังไม่เริ่ม
 *  กำลังดำเนินการ   = กองกำลังทำ/อัปเดตงาน (รวมกรณีถูกส่งกลับมาแก้)
 *  รอปลัด           = กองเซ็น+ส่งครบแล้ว รอปลัดเซ็น
 *  รอนายก           = ปลัดเซ็นแล้ว รอนายกพิจารณา
 *  เสร็จสิ้น         = นายกเซ็นปิดงาน
 *  ยกเลิก           = ยกเลิกเรื่อง
 */
export enum TicketStatus {
  ASSIGNED = 'รอดำเนินการ',
  IN_PROGRESS = 'กำลังดำเนินการ',
  PENDING_CLERK = 'รอปลัด',
  PENDING_MAYOR = 'รอนายก',
  RETURNED = 'ตีกลับ',
  COMPLETED = 'เสร็จสิ้น',
  CANCELLED = 'ยกเลิก',
}

/**
 * v4 workflow step (rework/saraban-v4) — เก็บเป็น code, label แสดงเติมชื่อกอง dynamic ที่ service/frontend
 *  PENDING_OWNER_HEAD    = รอผู้อำนวยกอง{กองเจ้าของ} พิจารณา   (เลือกกองเกี่ยว+ธุรการตัวเอง, ไม่เซ็น)
 *  PENDING_OWNER_CLERK   = รอธุรการกอง{กองเจ้าของ} ดำเนินการ   (ประทับเซ็น)
 *  PENDING_RELATED_HEAD  = รอผู้อำนวยกอง{กองเกี่ยว} ดำเนินการ  (เซ็น + เลือกธุรการตัวเอง)
 *  PENDING_RELATED_CLERK = รอธุรการกอง{กองเกี่ยว} ลงรับดำเนินการ (เซ็น + ลงเลขทะเบียนรับกอง)
 *  PENDING_CLERK         = รอปลัด ดำเนินการ   ·  PENDING_MAYOR = รอนายก ดำเนินการ
 */
export enum SarabanStep {
  /** flow ไดนามิก — อยู่กับผู้ถือเรื่อง (current_holder_user_id) เลือกส่งต่อเองได้อิสระ */
  PENDING_PERSON = 'PENDING_PERSON',
  // ── ขั้นตายตัวแบบเดิม (migration 1700000069000 ย้ายเรื่องค้างเป็น PENDING_PERSON แล้ว — คงไว้อ่านข้อมูลเก่า) ──
  PENDING_OWNER_HEAD = 'PENDING_OWNER_HEAD',
  PENDING_OWNER_CLERK = 'PENDING_OWNER_CLERK',
  PENDING_RELATED_HEAD = 'PENDING_RELATED_HEAD',
  PENDING_RELATED_CLERK = 'PENDING_RELATED_CLERK',
  PENDING_CLERK = 'PENDING_CLERK',
  PENDING_MAYOR = 'PENDING_MAYOR',
  COMPLETED = 'COMPLETED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

/** การส่งต่อ 1 ทอด (สารบรรณไดนามิก) */
export interface RouteHop {
  fromUserId: string;
  /** ขั้นของผู้ส่งตอนส่ง (CREATED = ตอนสร้างเรื่อง) — ใช้คืนขั้นตอนเมื่อถูกตีกลับ */
  fromStep: string;
  toUserId: string | null;
  toStep: string;
  toDeptId: string | null;
  at: string;
  note?: string | null;
}

@Entity('correspondence_tickets')
// เลขทะเบียน unique "ต่อสมุด ต่อปีงบ" — ตามระเบียบงานสารบรรณแต่ละเล่มมีเลขรันของตัวเอง
// และเริ่มนับ 1 ใหม่ทุกปีงบ (เลขซ้ำข้ามสมุด/ข้ามปีเป็นเรื่องปกติ)
// ตัวจริงเป็น partial unique index `uq_ticket_org_book_year_number` (เฉพาะ deleted_at IS NULL)
// สร้างใน migration 1700000020000 — TypeORM ประกาศ partial index แบบนี้ไม่ได้ จึงไม่ใส่ @Unique ที่นี่
@Index('idx_ticket_org_status', ['organizationId', 'status'])
export class CorrespondenceTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** เลขสารบรรณภายใน — ระบบ generate อัตโนมัติ ห้ามซ้ำ (แยกลำดับตามกอง) */
  @Column({ name: 'ticket_number', length: 50 })
  ticketNumber: string;

  /** เลขหนังสือภายนอกที่มากับเอกสารต้นทาง — กรอกเอง (เช่น 1234/2569) */
  @Column({ name: 'external_doc_number', length: 100, nullable: true })
  externalDocNumber: string;

  /** วันที่รับหนังสือ */
  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate: Date;

  /** วันที่ของหนังสือ */
  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  /** วันที่ต้นทางส่ง (แยกจากวันที่เรารับ) */
  @Column({ name: 'sent_date', type: 'date', nullable: true })
  sentDate: Date;

  /** เวลาที่ต้นทางส่ง (HH:mm) */
  @Column({ name: 'sent_time', length: 8, nullable: true })
  sentTime: string;

  /** วันครบกำหนดดำเนินการ (ใช้เตือนงานเกินกำหนด) */
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  /** ปีงบประมาณ (พ.ศ.) */
  @Column({ name: 'fiscal_year', type: 'smallint', nullable: true })
  fiscalYear: number;

  /** เวลารับหนังสือ (HH:mm) — คู่กับ receivedDate */
  @Column({ name: 'received_time', length: 8, nullable: true })
  receivedTime: string;

  // ── หน่วยงานต้นทาง / ผู้ส่ง ──
  @Column({ name: 'source_org', length: 255, nullable: true })
  sourceOrg: string;

  @Column({ name: 'sender_name', length: 255, nullable: true })
  senderName: string;

  @Column({ name: 'sender_position', length: 255, nullable: true })
  senderPosition: string;

  /** เรียน (ผู้รับหนังสือ) */
  @Column({ length: 255, nullable: true })
  recipient: string;

  @Column({ length: 500 })
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  /** คำสำคัญ (Keyword) ช่วยค้นหา */
  @Column({ length: 500, nullable: true })
  keywords: string;

  /** หมวดหนังสือ (รับ/ส่ง/ภายใน) */
  @Column({ name: 'doc_category', length: 100, nullable: true })
  docCategory: string;

  /** ประเภทหนังสือ (ทั่วไป/ความลับ/ร้องเรียน/บันทึกข้อความ/ประกาศ/คำสั่ง/รับรอง) */
  @Column({ name: 'doc_type', length: 100, nullable: true })
  docType: string;

  /** สมุดทะเบียนที่เรื่องนี้สังกัด (เลขรันแยกตามเล่ม) — ดู RegisterBook */
  @Column({ name: 'register_book', length: 30, default: RegisterBook.R_MAIN })
  registerBook: string;

  /** ทิศทาง: รับ/ส่ง */
  @Column({ name: 'direction', length: 10, default: TicketDirection.RECEIVE })
  direction: string;

  /** หนังสือเวียน (ส่งหลายผู้รับ) */
  @Column({ name: 'is_circular', type: 'boolean', default: false })
  isCircular: boolean;

  /** ผู้รับหนังสือเวียน (หลายราย — เก็บชื่อ/หน่วยงานปลายทางภายนอก) */
  @Column({ name: 'circular_recipients', type: 'jsonb', nullable: true })
  circularRecipients: string[];

  /** path ไฟล์ PDF ที่ประทับตรารับแล้ว (ข้อ 4) */
  @Column({ name: 'stamped_pdf_path', length: 500, nullable: true })
  stampedPdfPath: string;

  /** ชั้นความลับ — ใช้จำกัดสิทธิ์การเข้าถึง */
  @Column({ type: 'varchar', length: 20, default: TicketConfidentiality.NORMAL })
  confidentiality: string;

  /** วัตถุประสงค์ของหนังสือ (v4: เลือกได้ >1 เก็บรวมคั่นด้วย ", ") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string;

  /** ข้อความเมื่อเลือกวัตถุประสงค์ "อื่นๆ" */
  @Column({ name: 'purpose_other', length: 255, nullable: true })
  purposeOther: string;

  // ── อ้างถึง ──
  @Column({ name: 'ref_doc_number', length: 150, nullable: true })
  refDocNumber: string;

  @Column({ name: 'ref_doc_detail', type: 'text', nullable: true })
  refDocDetail: string;

  /** สิ่งที่ส่งมาด้วย (หลายรายการ) */
  @Column({ type: 'jsonb', nullable: true })
  enclosures: TicketEnclosure[];

  @Column({
    name: 'urgency_level',
    type: 'varchar',
    length: 20,
    default: TicketUrgency.NORMAL,
  })
  urgencyLevel: string;

  /** กองเจ้าของเรื่อง */
  @Column({ name: 'owner_dept_id', nullable: true })
  ownerDeptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'owner_dept_id' })
  ownerDept: Department;

  /** ผู้รับผิดชอบหลัก */
  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: TicketStatus.ASSIGNED,
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  // ── ลายเซ็นปลัด ──
  @Column({ name: 'clerk_signed_by', nullable: true })
  clerkSignedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'clerk_signed_by' })
  clerkSigner: User;

  @Column({ name: 'clerk_signed_at', type: 'timestamptz', nullable: true })
  clerkSignedAt: Date;

  // ── ลายเซ็นนายก ──
  @Column({ name: 'mayor_signed_by', nullable: true })
  mayorSignedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mayor_signed_by' })
  mayorSigner: User;

  @Column({ name: 'mayor_signed_at', type: 'timestamptz', nullable: true })
  mayorSignedAt: Date;

  // ═══════════ v4 workflow (rework/saraban-v4) ═══════════
  /** ขั้นปัจจุบันใน workflow v4 (SarabanStep) — engine ใหม่ขับด้วยฟิลด์นี้ */
  @Column({ name: 'current_step', length: 30, nullable: true })
  currentStep: string;

  /** กองที่เกี่ยวข้อง (หัวหน้ากองเจ้าของเลือก — 1 กอง) */
  @Column({ name: 'related_dept_id', nullable: true })
  relatedDeptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'related_dept_id' })
  relatedDept: Department;

  /** ผู้ปฏิบัติ = หัวหน้ากอง ที่คนสร้างเลือกตอนสร้าง (step แรก) */
  @Column({ name: 'assigned_head_user_id', nullable: true })
  assignedHeadUserId: string;

  /** ธุรการกองเจ้าของ (หัวหน้ากองเจ้าของเลือก) */
  @Column({ name: 'owner_clerk_user_id', nullable: true })
  ownerClerkUserId: string;

  /** หัวหน้ากองที่เกี่ยว (auto = หัวหน้าของ related dept) */
  @Column({ name: 'related_head_user_id', nullable: true })
  relatedHeadUserId: string;

  /** ธุรการกองที่เกี่ยว (หัวหน้ากองที่เกี่ยวเลือก) */
  @Column({ name: 'related_clerk_user_id', nullable: true })
  relatedClerkUserId: string;

  /** ปลัด/นายก ที่เลือกตอนส่ง (รองรับรองนายก/รักษาการ) */
  @Column({ name: 'pending_clerk_user_id', nullable: true })
  pendingClerkUserId: string;

  @Column({ name: 'pending_mayor_user_id', nullable: true })
  pendingMayorUserId: string;

  /** เลขทะเบียนรับกอง (ธุรการกองที่เกี่ยวลง) + วันเวลา auto */
  @Column({ name: 'dept_reg_number', length: 100, nullable: true })
  deptRegNumber: string;

  @Column({ name: 'dept_reg_at', type: 'timestamptz', nullable: true })
  deptRegAt: Date;

  /** ลายเซ็นแต่ละ step: [{ step, userId, signedAt, signatureId? }] */
  @Column({ name: 'step_signatures', type: 'jsonb', nullable: true })
  stepSignatures: { step: string; userId: string; signedAt: string; signatureId?: string }[];

  /** ผู้ถือเรื่องปัจจุบัน (ขั้น PENDING_PERSON) — ปลัด/นายกไม่ใช้ (ใครมี role ก็ทำได้) */
  @Column({ name: 'current_holder_user_id', nullable: true })
  currentHolderUserId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'current_holder_user_id' })
  currentHolder: User;

  /** เส้นทางการส่งต่อ (stack) — ตีกลับ = ถอยทอดล่าสุดกลับไปหาผู้ส่ง */
  @Column({ name: 'route_trail', type: 'jsonb', default: () => "'[]'::jsonb" })
  routeTrail: RouteHop[];

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  /** ตำแหน่ง overlay (ตราเลขรับ + ลายเซ็น) ที่วางบน PDF เดิม — { pages, items[] } */
  @Column({ name: 'overlay_layout', type: 'jsonb', nullable: true })
  overlayLayout: any;

  // ── บันทึกการรับเอกสาร (ปุ่มแยก ไม่กระทบสถานะ workflow) ──
  @Column({ name: 'received_by', nullable: true })
  receivedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receiver: User;

  @Column({ name: 'received_record_at', type: 'timestamptz', nullable: true })
  receivedRecordAt: Date;

  /** เลขทะเบียนรับ (กรอกตอนรับเอกสาร) */
  @Column({ name: 'receive_reg_number', length: 100, nullable: true })
  receiveRegNumber: string;

  @Column({ name: 'receive_note', type: 'text', nullable: true })
  receiveNote: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => CorrespondenceTicketDepartment, (td) => td.ticket)
  ticketDepartments: CorrespondenceTicketDepartment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
