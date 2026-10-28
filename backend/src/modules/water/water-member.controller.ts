import {
  Controller, Get, Post, Query, Req, Res, UseInterceptors, UploadedFile, BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WaterBillingService } from './water-billing.service';

/**
 * พอร์ทัลสมาชิก (สาธารณะ) — ให้ประชาชนเช็คค่าน้ำเองด้วย "เบอร์โทร" ที่แจ้งไว้กับ อบต.
 * เลียนแบบระบบ vendor (mongkolonline) แต่ทำเป็น multi-tenant DB เดียว
 *
 * ความปลอดภัย: ไม่มี JWT (เข้าถึงด้วยเบอร์) → ทุก request ต้องแนบเบอร์และตรวจว่าตรงกับ customerId เสมอ
 * (กันไล่สุ่ม id) + rate-limit ต่อ IP กันไล่สุ่มเบอร์ดูข้อมูลชาวบ้าน
 */

// rate-limit ง่ายๆ ในหน่วยความจำ (self-host instance เดียว) — ต่อ IP
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 40; // 40 ครั้ง/นาที/IP เพียงพอสำหรับผู้ใช้จริง แต่กันสุ่มจำนวนมาก
function rateLimit(ip: string) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (arr.length > MAX_HITS) {
    throw new HttpException('มีการเรียกข้อมูลถี่เกินไป กรุณารอสักครู่', HttpStatus.TOO_MANY_REQUESTS);
  }
}
// เก็บกวาด map เป็นระยะ
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of HITS) {
    const keep = arr.filter((t) => now - t < WINDOW_MS);
    if (keep.length) HITS.set(ip, keep); else HITS.delete(ip);
  }
}, WINDOW_MS).unref?.();

@ApiTags('water-member')
@Controller('water/member')
export class WaterMemberController {
  constructor(private readonly service: WaterBillingService) {}

  private ip(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  @Get('lookup')
  @ApiOperation({ summary: 'ล็อกอินสมาชิกด้วยรหัสจากใบแจ้งหนี้ / เบอร์โทร / รหัสผู้ใช้น้ำ+บ้านเลขที่ / ชื่อ-สกุล+(บ้านเลขที่ หรือ เลขบัตรประชาชน) → คืนบ้าน/มิเตอร์ทุกหลังที่ตรง' })
  lookup(@Req() req: Request, @Query('phone') phone: string, @Query('org') org?: string,
    @Query('cc') cc?: string, @Query('house') house?: string, @Query('name') name?: string, @Query('nationalId') nationalId?: string,
    @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberLookup(phone, org, cc, house, name, nationalId, token);
  }

  @Get('linked')
  @ApiOperation({ summary: 'หาบ้านอื่นของคนจ่ายหลายบ้าน (ชื่อเดียวกัน) — ต้อง verify เจ้าของ customerId ก่อนเสมอ' })
  linked(@Req() req: Request, @Query('customerId') customerId: string,
    @Query('phone') phone: string, @Query('house') house: string, @Query('org') org?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberFindLinked(customerId, { phone, house, token }, org);
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'ค้างชำระของบ้านหนึ่ง + QR พร้อมเพย์' })
  outstanding(@Req() req: Request, @Query('customerId') customerId: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberOutstanding(customerId, phone, org, house, token);
  }

  @Get('qr')
  @ApiOperation({ summary: 'QR พร้อมเพย์ตามยอดที่ประชาชนเลือกจ่าย (เลือกเฉพาะบางเดือนได้)' })
  memberQr(@Req() req: Request, @Query('customerId') customerId: string, @Query('phone') phone: string,
    @Query('amount') amount: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberQr(customerId, { phone, house, token }, org, Number(amount));
  }

  @Get('payments')
  @ApiOperation({ summary: 'ประวัติการชำระ' })
  payments(@Req() req: Request, @Query('customerId') customerId: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberPayments(customerId, phone, org, house, token);
  }

  @Get('usage')
  @ApiOperation({ summary: 'ประวัติการใช้น้ำ (จดก่อน/จดหลัง/ใช้ไป)' })
  usage(@Req() req: Request, @Query('customerId') customerId: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberUsage(customerId, phone, org, house, token);
  }

  @Get('invoice')
  @ApiOperation({ summary: 'ใบแจ้งหนี้ค่าน้ำ (PDF) — ฝั่งสมาชิก' })
  async invoice(@Req() req: Request, @Res() res: Response,
    @Query('customerId') customerId: string, @Query('billId') billId: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    const { buffer, filename } = await this.service.memberBillDoc(customerId, billId, phone, 'invoice', org, house, token);
    this.sendPdf(res, buffer, filename, 'water-invoice.pdf');
  }

  @Post('slip')
  @ApiOperation({ summary: 'แนบสลิปโอนเงินของบิลค้าง (จ่าย QR แล้วรอเจ้าหน้าที่ยืนยัน) — billIds คั่นด้วย , ถ้าจ่ายรวมหลายบิล' })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('แนบได้เฉพาะรูปภาพ') as any, false),
  }))
  uploadSlip(@Req() req: Request, @UploadedFile() file: Express.Multer.File,
    @Query('customerId') customerId: string, @Query('billIds') billIds: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    return this.service.memberUploadSlip(customerId, (billIds || '').split(',').filter(Boolean), phone, file, org, house, token);
  }

  @Get('receipt')
  @ApiOperation({ summary: 'ใบเสร็จรับเงินค่าน้ำ (PDF) — ฝั่งสมาชิก' })
  async receipt(@Req() req: Request, @Res() res: Response,
    @Query('customerId') customerId: string, @Query('billId') billId: string, @Query('phone') phone: string, @Query('org') org?: string, @Query('house') house?: string, @Query('token') token?: string) {
    rateLimit(this.ip(req));
    const { buffer, filename } = await this.service.memberBillDoc(customerId, billId, phone, 'receipt', org, house, token);
    this.sendPdf(res, buffer, filename, 'water-receipt.pdf');
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string, ascii: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
