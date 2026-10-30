import { Controller, Get, Post, Param, Query, Body, Req, UseInterceptors, UploadedFile, BadRequestException, HttpException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CitizenPayService } from './citizen-pay.service';

class ReserveDto {
  @IsString() @MaxLength(200) name: string;
  @IsString() @MaxLength(20) phone: string;
  /** วันเริ่มเช่า (YYYY-MM-DD) และจำนวนวัน — สำหรับแผงรายวัน */
  @IsOptional() @IsString() @MaxLength(10) rentalStartDate?: string;
  @IsOptional() @IsString() @MaxLength(4) rentalDays?: string;
  @IsOptional() @IsString() org?: string;
}
class ApplyOutsideDto {
  @IsString() @MaxLength(200) name: string;
  @IsString() @MaxLength(20) phone: string;
  @IsOptional() @IsString() @MaxLength(10) startDate?: string;
  @IsOptional() @IsString() @MaxLength(4) days?: string;
  @IsOptional() @IsString() org?: string;
}
class SubmitDto {
  /** รหัสบิลคั่นด้วยจุลภาค */
  @IsString() @MaxLength(2000) billIds: string;
  @IsString() method: string;
  /** ชื่อผู้เช่า/ผู้รับบิล — ต้องตรงกับบิล */
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() org?: string;
}

// rate-limit ในหน่วยความจำต่อ IP — ค้นบิลของคนอื่นต้องไม่ถูกไล่เดาถี่ ๆ (เหมือนหน้า checkbill/แจ้งเรื่อง)
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
// หน้าประชาชนดึงสถานะแผง/จุดแผงลอยทุก 2 วินาที (ต่อ IP) จึงตั้งโควตาทั่วไปไว้สูง — การยืนยันชื่อ (strict) ยังจำกัดเข้มงวดแยก
const MAX_HITS = 300;
function rateLimit(ip: string, max = MAX_HITS, bucket = '') {
  const now = Date.now();
  const key = bucket + ip;
  const arr = (HITS.get(key) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(key, arr);
  if (arr.length > max) throw new HttpException('ทำรายการถี่เกินไป กรุณารอสักครู่', HttpStatus.TOO_MANY_REQUESTS);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of HITS) {
    const keep = arr.filter((t) => now - t < WINDOW_MS);
    if (keep.length) HITS.set(ip, keep); else HITS.delete(ip);
  }
}, WINDOW_MS).unref?.();

/** ประชาชนจ่ายค่าแผง/ค่าขยะ (สาธารณะ ไม่มี JWT) — ดูบิลที่ค้าง · แจ้งชำระ+แนบสลิป · จองแผง · เจ้าหน้าที่เป็นผู้ยืนยันรับเงิน */
@ApiTags('citizen-pay')
@Controller('citizen/pay')
export class CitizenPayController {
  constructor(private readonly service: CitizenPayService) {}

  /** strict = ขั้นตอนยืนยันตัวตนด้วยชื่อ (กันไล่เดา) จำกัด 10 ครั้ง/นาที/IP */
  private async org(req: Request, code?: string, strict = false) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    rateLimit(ip);
    if (strict) rateLimit(ip, 10, 'verify:');
    return this.service.resolveOrg((req.headers['x-forwarded-host'] as string) || req.headers.host, code);
  }

  @Get('config')
  @ApiOperation({ summary: 'ช่องทางรับเงิน + ราคา ของ อบต. (ตามโดเมน)' })
  async config(@Req() req: Request, @Query('org') org?: string) {
    return this.service.publicConfig(await this.org(req, org));
  }

  @Get('waste/bills')
  @ApiOperation({ summary: 'ค้นบิลค่าขยะบ้านที่ยังไม่จ่าย — ต้องกรอกชื่อคู่กับ (บ้านเลขที่+หมู่ หรือ เบอร์) ให้ตรงกัน' })
  async wasteBills(@Req() req: Request, @Query('q') q: string, @Query('name') name: string, @Query('org') org?: string) {
    return this.service.wasteBillsFor(await this.org(req, org, true), q, name);
  }

  @Post('market/stalls/:code/reserve')
  @ApiOperation({ summary: 'จองแผงว่าง (แนบรูปบัตรประชาชนได้) — รอเจ้าหน้าที่ยืนยัน และแจ้งเจ้าหน้าที่' })
  @UseInterceptors(FileInterceptor('idCard', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('แนบได้เฉพาะรูปภาพ') as any, false),
  }))
  async reserve(@Req() req: Request, @Param('code') code: string, @UploadedFile() card: Express.Multer.File | undefined, @Body() dto: ReserveDto) {
    return this.service.reserve(await this.org(req, dto.org, true), code, dto.name, dto.phone, card, dto.rentalStartDate, Number(dto.rentalDays) || undefined);
  }

  @Post('market/outside/:id/apply')
  @ApiOperation({ summary: 'สมัครแผงลอย (แนบรูปบัตร) → รอเจ้าหน้าที่อนุมัติ แล้วจึงออกบิลค่าเช่า (รหัส OUT-xxxx)' })
  @UseInterceptors(FileInterceptor('idCard', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('แนบได้เฉพาะรูปภาพ') as any, false),
  }))
  async applyOutside(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() card: Express.Multer.File | undefined, @Body() dto: ApplyOutsideDto) {
    return this.service.applyOutside(await this.org(req, dto.org, true), id, dto.name, dto.phone, card, dto.startDate, Number(dto.days) || undefined);
  }

  @Get('market/outside')
  @ApiOperation({ summary: 'จุดแผงลอยที่เปิดให้เช่า (สาธารณะ)' })
  async outside(@Req() req: Request, @Query('org') org?: string) {
    return this.service.outsideLocations(await this.org(req, org));
  }

  @Get('market/stalls')
  @ApiOperation({ summary: 'ผังแผงตลาด (ไม่มีชื่อผู้เช่า)' })
  async stalls(@Req() req: Request, @Query('org') org?: string) {
    return this.service.marketStalls(await this.org(req, org));
  }

  @Get('market/bills')
  @ApiOperation({ summary: 'บิลค่าแผงที่ยังไม่จ่าย — ต้องกรอกเลขล็อก + ชื่อผู้เช่าให้ตรงกัน' })
  async marketBills(@Req() req: Request, @Query('stall') stall: string, @Query('name') name: string, @Query('org') org?: string) {
    return this.service.marketBillsFor(await this.org(req, org, true), stall, name);
  }


  @Post(':type/submit')
  @ApiOperation({ summary: 'แจ้งชำระหลายบิลพร้อมกัน: โอน (แนบสลิป → ตรวจอัตโนมัติ) หรือเงินสด (รอรับที่ อบต.)' })
  @UseInterceptors(FileInterceptor('slip', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('แนบได้เฉพาะรูปภาพ') as any, false),
  }))
  async submit(@Req() req: Request, @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: SubmitDto) {
    if (type !== 'market' && type !== 'waste') throw new BadRequestException('ประเภทบิลไม่ถูกต้อง');
    const ids = String(dto.billIds || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.some((x) => !/^[0-9a-f-]{36}$/i.test(x))) throw new BadRequestException('รหัสบิลไม่ถูกต้อง');
    return this.service.submitBills(await this.org(req, dto.org, true), type, ids, dto.method, dto.name, file);
  }
}
