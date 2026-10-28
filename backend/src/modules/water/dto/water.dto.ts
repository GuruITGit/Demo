import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsNumber, IsDateString, MaxLength, IsArray, ValidateNested, ArrayMaxSize, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// ─────────────────────────────── ทะเบียนผู้ใช้น้ำ
export class CreateWaterCustomerDto {
  /** ไม่ต้องกรอก — ระบบสุ่มรหัส 6 หลัก (อักษร+เลข) ให้อัตโนมัติ ใช้เป็นทั้งรหัสทะเบียนและรหัสใบแจ้งหนี้/QR ตัวเดียวกัน */
  @IsOptional() @IsString() @MaxLength(20)
  customerCode?: string;

  @IsString() @IsNotEmpty({ message: 'กรุณากรอกชื่อ-สกุล' }) @MaxLength(200)
  fullName: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99)
  villageNo?: number;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @IsOptional() @IsString()
  note?: string;

  // ── ฟิลด์เต็มตามระบบเก่า (แก้ไขได้จากฟอร์ม) ──
  @IsOptional() @IsString() @MaxLength(20)
  nationalId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  soi?: string;

  @IsOptional() @IsString() @MaxLength(100)
  road?: string;

  @IsOptional() @IsString() @MaxLength(60)
  meterSerial?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  meterLastReading?: number;

  @IsOptional() @IsString() @MaxLength(10)
  meterSizeCode?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  meterDigits?: number;

  @IsOptional() @IsString() @MaxLength(20)
  collectionRoute?: string;

  /** ลำดับการเดินจดมิเตอร์ในหมู่ (อบต.กำหนด) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  walkOrder?: number;

  /** สถานะการใช้งาน: 01=ใช้งาน 02=ยกเลิก 03=งดจ่ายน้ำ */
  @IsOptional() @IsIn(['01', '02', '03'])
  usageStatus?: string;

  @IsOptional() @IsString() @MaxLength(40)
  bankAccount?: string;

  @IsOptional() @IsString() @MaxLength(120)
  bankName?: string;

  /** ราคาต่อหน่วยเฉพาะราย (บาท) — ว่าง/null = ใช้เรตกลางของ อบต. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice?: number;
}
export class UpdateWaterCustomerDto extends PartialType(CreateWaterCustomerDto) {}

/** ตั้งราคาต่อหน่วยทีเดียวหลายคน (แทนการแก้ทีละคนแบบ vendor) */
export class BulkUnitPriceDto {
  /** ราคาต่อหน่วยที่จะตั้ง (บาท) · null = ล้างค่า กลับไปใช้เรตกลาง */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice?: number | null;

  /** ขอบเขต: all=ทุกคน · village=ทั้งหมู่ (ระบุ villageNo) · ids=เฉพาะที่เลือก */
  @IsIn(['all', 'village', 'ids'])
  scope: 'all' | 'village' | 'ids';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99)
  villageNo?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  ids?: string[];
}

// ─────────────────────────────── แบบคำขอใช้น้ำ/สัญญา
export class SaveWaterApplicationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(150)
  age?: number;

  @IsOptional() @IsDateString()
  idExpiry?: string;

  @IsOptional() @IsString() @MaxLength(120)
  occupation?: string;

  @IsOptional() @IsString() @MaxLength(200)
  workplace?: string;

  @IsOptional() @IsString() @MaxLength(120)
  purpose?: string;

  @IsOptional() @IsString() @MaxLength(255)
  operateAt?: string;

  @IsOptional() @IsString() @MaxLength(255)
  nearby?: string;

  @IsOptional() @IsString() @MaxLength(20)
  pipeSize?: string;

  @IsOptional() @IsString() @MaxLength(20)
  faucetSize?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  faucetCount?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  depositAmount?: number;

  @IsOptional() @IsString() @MaxLength(200)
  receiver?: string;

  @IsOptional() @IsDateString()
  applyDate?: string;

  @IsOptional()
  done?: boolean;

  @IsOptional() @IsString() @MaxLength(200)
  contractSigner?: string;

  @IsOptional() @IsString() @MaxLength(200)
  witness1?: string;

  @IsOptional() @IsString() @MaxLength(200)
  witness2?: string;
}

export class WaterCustomerQueryDto extends PaginationDto {
  /** กรองตามหมู่ */
  @IsOptional() @Type(() => Number) @IsInt()
  villageNo?: number;

  /** กรองสถานะการใช้งาน: active = ใช้งาน(01) · inactive = ยกเลิก/งดจ่าย(02,03) */
  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;

  /** กรองตามจำนวนงวดที่ค้างชำระ: 0 = ไม่ค้าง · 1/2 = ค้างพอดี N งวด · 3plus = ค้างตั้งแต่ 3 งวดขึ้นไป */
  @IsOptional() @IsIn(['0', '1', '2', '3plus'])
  overdue?: string;
}

// ─────────────────────────────── หนังสือแจ้งค้างชำระ
export class CreateWaterNoticeDto {
  /** วันที่บนหัวหนังสือ (ค.ศ. รูปแบบ YYYY-MM-DD) */
  @IsDateString({}, { message: 'กรุณาเลือกวันที่ของหนังสือ' })
  noticeDate: string;

  /** เลือกจากทะเบียน — ถ้าไม่ส่งมา ต้องกรอก customerCode/fullName เอง */
  @IsOptional() @IsString()
  customerId?: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาเลือกผู้ใช้น้ำ' }) @MaxLength(20)
  customerCode: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อผู้รับหนังสือ' }) @MaxLength(200)
  fullName: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99)
  villageNo?: number;

  @Type(() => Number) @IsInt() @Min(1, { message: 'เดือนไม่ถูกต้อง' }) @Max(12, { message: 'เดือนไม่ถูกต้อง' })
  periodMonth: number;

  /** ปี พ.ศ. ของเดือนที่ค้างชำระ */
  @Type(() => Number) @IsInt() @Min(2500) @Max(2700)
  periodYear: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'จำนวนเงินไม่ถูกต้อง' })
  @Min(0.01, { message: 'จำนวนเงินต้องมากกว่า 0' })
  amount: number;

  /** ระบุเลขที่หนังสือเอง — ไม่ส่ง = ระบบรันเลขถัดไปให้ */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  docNumber?: number;
}

export class WaterNoticeQueryDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt()
  villageNo?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  periodMonth?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  periodYear?: number;
}

// ─────────────────────────────── สรุปการเก็บค่าน้ำ (dashboard)
export class CollectionRowDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(99)
  villageNo: number;

  @Type(() => Number) @IsInt() @Min(0)
  customers: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  billedAmount: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  collectedAmount: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  units?: number;
}

/** บันทึกตัวเลขของทั้งงวด (แทนที่ของงวดนั้นทั้งชุด) */
export class SaveCollectionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  periodMonth: number;

  @Type(() => Number) @IsInt() @Min(2500) @Max(2700)
  periodYear: number;

  @IsArray() @ArrayMaxSize(99) @ValidateNested({ each: true }) @Type(() => CollectionRowDto)
  rows: CollectionRowDto[];
}

export class CollectionQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month: number;

  @Type(() => Number) @IsInt() @Min(2500) @Max(2700)
  year: number;
}

// ─────────────────────────────── ระบบเก็บค่าน้ำ v2 (field app จดมิเตอร์)
export class PeriodQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month: number;

  @Type(() => Number) @IsInt() @Min(2500) @Max(2700)
  year: number;

  /** กรองตามหมู่/เส้นทาง (ตอนดูรายชื่อในเล่ม) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99)
  villageNo?: number;

  @IsOptional() @IsString()
  search?: string;
}

export class SaveReadingDto {
  @IsString() @IsNotEmpty({ message: 'ไม่พบผู้ใช้น้ำ' })
  customerId: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(12)
  periodMonth: number;

  @Type(() => Number) @IsInt() @Min(2500) @Max(2700)
  periodYear: number;

  @Type(() => Number) @IsInt() @Min(0, { message: 'เลขมิเตอร์ต้องไม่ติดลบ' })
  currReading: number;

  @IsOptional() @IsString()
  issueType?: string;

  /** เบอร์โทรสมาชิก — กรอกตอนจดได้ (บันทึกกลับทะเบียนเพื่อให้ล็อกอินพอร์ทัลเช็คค่าน้ำ) */
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  /** พิกัดมาตรวัดน้ำ "lat,lng" — ปักตอนจด (สะสมทำแผนที่ GIS) */
  @IsOptional() @IsString() @MaxLength(60)
  gps?: string;

  @IsOptional() @IsString()
  note?: string;
}

export class ReceivePaymentDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  paidAmount?: number;

  @IsOptional() @IsString() @MaxLength(40)
  receiptNo?: string;

  /** cash / qr / transfer */
  @IsOptional() @IsString() @MaxLength(12)
  payMethod?: string;

  /** id ผลตรวจสลิปที่ผ่านแล้ว — บังคับเมื่อ payMethod='qr' และเปิดตรวจสลิปอัตโนมัติ */
  @IsOptional() @IsString() @MaxLength(40)
  slipVerifyId?: string;
}

export class PayBillsDto {
  @IsString() @IsNotEmpty({ message: 'ไม่พบผู้ใช้น้ำ' })
  customerId: string;

  @IsArray() @ArrayMaxSize(60) @IsString({ each: true })
  billIds: string[];

  @IsOptional() @IsString() @MaxLength(40)
  receiptNo?: string;

  /** cash / qr / transfer */
  @IsOptional() @IsString() @MaxLength(12)
  payMethod?: string;

  /** id ผลตรวจสลิปที่ผ่านแล้ว — บังคับเมื่อ payMethod='qr' และเปิดตรวจสลิปอัตโนมัติ */
  @IsOptional() @IsString() @MaxLength(40)
  slipVerifyId?: string;
}

export class CancelPaymentDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุเหตุผลการยกเลิกการรับชำระ' }) @MaxLength(300)
  reason: string;
}

export class UpdateRateDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  serviceFee: number;

  /** พร้อมเพย์ปลายทาง (เบอร์/เลขบัตร ปชช.) — ว่าง = ไม่แสดง QR จ่ายเงิน */
  @IsOptional() @IsString() @MaxLength(30)
  promptpayId?: string;

  @IsOptional() @IsString() @MaxLength(12)
  promptpayType?: string;

  /** Biller ID (Comp Code) KTB Bill Payment — ตั้งแล้วบิลออก QR แบบกระทบยอดอัตโนมัติได้ */
  @IsOptional() @IsString() @MaxLength(20)
  ktbBillerId?: string;

  /** ผู้ให้บริการตรวจสลิปอัตโนมัติ: easyslip | slipok (ว่าง = ปิด) */
  @IsOptional() @IsString() @MaxLength(20)
  slipVerifyProvider?: string;

  /** token ตรวจสลิป — ส่งมาเฉพาะตอนเปลี่ยน (ไม่ส่ง = คงของเดิม) */
  @IsOptional() @IsString() @MaxLength(200)
  slipVerifyToken?: string;

  /** true = ล้าง token ตรวจสลิป */
  @IsOptional()
  slipVerifyClear?: boolean;

  /** ผู้ให้บริการตรวจสลิปหลายเจ้า เรียงลำดับใช้งาน — token ว่าง = คงของเดิมของเจ้านั้น */
  @IsOptional() @IsArray()
  slipVerifyProviders?: { provider: string; token?: string }[];

  /** ชื่อบัญชีผู้รับเงินที่ถูกต้อง (ตามที่ขึ้นบนสลิป) — ใช้เทียบบัญชีปลายทาง */
  @IsOptional() @IsString() @MaxLength(200)
  slipReceiverName?: string;

  @IsOptional() @IsString() @MaxLength(120)
  payeeName?: string;

  // ค่าธรรมเนียม default + ตั้งค่าเอกสาร (admin)
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  garbageFee?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  wastewaterFee?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0)
  taxRate?: number;

  @IsOptional() @IsString() @MaxLength(500)
  receiptHeader?: string;

  @IsOptional() @IsString() @MaxLength(500)
  receiptFooter?: string;

  @IsOptional() @IsString() @MaxLength(120)
  docTitle?: string;

  /** หัว/ท้าย "ใบแจ้งหนี้" แยกจากใบเสร็จ */
  @IsOptional() @IsString() @MaxLength(500)
  invoiceHeader?: string;

  @IsOptional() @IsString() @MaxLength(500)
  invoiceFooter?: string;

  /** ใบเสร็จ/ใบแจ้งหนี้หมดอายุกี่วัน (default 30) */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  billExpiryDays?: number;

  /** รูปลายเซ็นรายงาน/ใบเตือน (dataURL หรือ URL) */
  @IsOptional() @IsString()
  reportSignatureUrl?: string;

  @IsOptional() @IsString()
  warningSignatureUrl?: string;

  /** ใบเสร็จสีฟ้า: รูปตรา/ลายเซ็น (dataURL) + ค่าเลื่อน (มม.) */
  @IsOptional() @IsString()
  receiptSealUrl?: string;

  @IsOptional() @IsString()
  receiptSignatureUrl?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-30) @Max(30)
  receiptOffsetX?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-30) @Max(30)
  receiptOffsetY?: number;

  /** โหมดคิดค่าน้ำ: flat (ราคาต่อหน่วยเดียว) หรือ tiered (คิดตามขั้น) */
  @IsOptional() @IsString() @MaxLength(12)
  rateMode?: string;

  /** ขั้นค่าน้ำ [{from,to,price}] เมื่อ rateMode='tiered' */
  @IsOptional() @IsArray()
  tiers?: { from: number; to: number; price: number }[];

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  minUnits?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  minCharge?: number;

  /** ข้อมูลหน่วยงานเฉพาะประปา (แถบบน/หัวเอกสาร) — ว่าง = ใช้จากระบบหลัก */
  @IsOptional() @IsString() @MaxLength(200)
  orgName?: string;

  @IsOptional() @IsString() @MaxLength(500)
  orgAddress?: string;

  @IsOptional() @IsString() @MaxLength(50)
  orgPhone?: string;

  /** โลโก้ dataURL (หน้าเว็บย่อ ≤ 256px ก่อนส่ง) */
  @IsOptional() @IsString() @MaxLength(300_000)
  orgLogoUrl?: string;

  /** หนังสือแจ้งค้างชำระ — เลขที่หนังสือ/กอง/ผู้ลงนาม/กำหนดชำระ */
  @IsOptional() @IsString() @MaxLength(60)
  noticeDocPrefix?: string;

  @IsOptional() @IsString() @MaxLength(200)
  noticeAddressLine?: string;

  @IsOptional() @IsString() @MaxLength(120)
  noticeDivision?: string;

  @IsOptional() @IsString() @MaxLength(50)
  noticePhone?: string;

  @IsOptional() @IsString() @MaxLength(160)
  noticeSignerName?: string;

  @IsOptional() @IsString() @MaxLength(200)
  noticeSignerTitle?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  noticeDueDays?: number;
}

// ─────────────────────────────── พอร์ทัลสมาชิก (public — ล็อกอินด้วยเบอร์โทร)
export class MemberLookupDto {
  @IsString() @IsNotEmpty({ message: 'กรุณากรอกเบอร์โทร' }) @MaxLength(20)
  phone: string;

  /** รหัสองค์กร — ถ้าระบบมี อบต. เดียวไม่ต้องส่ง (เลือกอัตโนมัติ) */
  @IsOptional() @IsString() @MaxLength(40)
  org?: string;
}

export class MemberAccountDto extends MemberLookupDto {
  /** ต้องส่งคู่เบอร์เพื่อยืนยันว่าเป็นเจ้าของบ้านนั้นจริง (กัน IDOR) */
  @IsString() @IsNotEmpty()
  customerId: string;
}

/** 1 รายการชำระที่ธนาคารส่งมา (หน้าเว็บ map คอลัมน์จากไฟล์ Excel/CSV แล้วส่งมาเป็น normalized) */
export class ReconcileRowDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  ref1: string; // รหัสผู้ใช้น้ำ

  @IsOptional() @IsString() @MaxLength(20)
  ref2?: string; // งวด YYYYMM (ถ้ามี)

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  amount: number;

  @IsOptional() @IsDateString()
  paidAt?: string;

  @IsOptional() @IsString() @MaxLength(60)
  txnRef?: string; // เลขอ้างอิงรายการของธนาคาร (กันซ้ำ/ตรวจสอบย้อนหลัง)
}

/** กระทบยอดจากไฟล์ธนาคาร — dryRun=true พรีวิวก่อน, false = ตัดชำระจริง */
export class ReconcileDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReconcileRowDto) @ArrayMaxSize(20000)
  rows: ReconcileRowDto[];

  @IsOptional()
  dryRun?: boolean;
}
