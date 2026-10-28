import {
  Controller, Post, Get, Body, Query, Req, UseInterceptors, UploadedFile, UploadedFiles,
  BadRequestException, HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CitizenReportService } from './citizen-report.service';
import { CreateReportDto } from './dto/citizen-report.dto';

// rate-limit ในหน่วยความจำต่อ IP — กันสแปม (แจ้งเรื่องไม่ถี่เท่าเช็คค่าน้ำ จึงตั้งต่ำกว่า)
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 15;
function rateLimit(ip: string) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  if (arr.length > MAX_HITS) throw new HttpException('ส่งเรื่องถี่เกินไป กรุณารอสักครู่', HttpStatus.TOO_MANY_REQUESTS);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of HITS) {
    const keep = arr.filter((t) => now - t < WINDOW_MS);
    if (keep.length) HITS.set(ip, keep); else HITS.delete(ip);
  }
}, WINDOW_MS).unref?.();

/**
 * รับเรื่องแจ้ง/ร้องเรียนจากประชาชน (สาธารณะ ไม่มี JWT) — แนบรูปได้ ไม่บังคับ
 * เก็บลงกล่องแยก (citizen_reports) เจ้าหน้าที่ค่อยคัดกรอง (ไม่ยิงเข้าสารบรรณตรง ๆ กันสแปม)
 */
@ApiTags('citizen-report')
@Controller('citizen/report')
export class CitizenReportController {
  constructor(private readonly service: CitizenReportService) {}

  private ip(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  @Post()
  @ApiOperation({ summary: 'ประชาชนแจ้งเรื่อง/ร้องเรียน (แนบรูปได้ ไม่บังคับ)' })
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => /^image\//.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('แนบได้เฉพาะรูปภาพ') as any, false),
  }))
  create(@Req() req: Request, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: CreateReportDto) {
    rateLimit(this.ip(req));
    return this.service.create(dto, file);
  }

  @Post('submit')
  @ApiOperation({ summary: 'ส่งคำร้องจากเอนจินฟอร์ม (คำตอบ jsonb + ไฟล์หลายช่อง + พิกัด)' })
  @UseInterceptors(AnyFilesInterceptor({
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => /^(image\/|application\/pdf|application\/msword|application\/vnd|application\/octet-stream|text\/)/.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException('ชนิดไฟล์ไม่รองรับ') as any, false),
  }))
  submit(@Req() req: Request, @UploadedFiles() files: Express.Multer.File[], @Body() body: any) {
    rateLimit(this.ip(req));
    return this.service.createSubmission(body, files);
  }

  @Get('nearest-village')
  @ApiOperation({ summary: 'เดาหมู่ที่จากพิกัด GPS (ใช้มาตรวัดน้ำที่ใกล้สุดเป็นตัวอ้างอิง) — เป็นค่าแนะนำ ไม่ใช่ขอบเขตทางการ' })
  nearestVillage(@Req() req: Request, @Query('lat') lat: string, @Query('lng') lng: string, @Query('org') org?: string) {
    rateLimit(this.ip(req));
    const la = Number(lat), ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) throw new BadRequestException('พิกัดไม่ถูกต้อง');
    return this.service.nearestVillage(la, ln, org);
  }

  @Get('suggest-names')
  @ApiOperation({ summary: 'แนะนำชื่อผู้แจ้งแบบเรียลไทม์ (ช่วยพิมพ์ชื่อให้ตรงตอนติดตามสถานะ) — ฝั่ง frontend ต้อง debounce เอง' })
  suggestNames(@Req() req: Request, @Query('q') q: string, @Query('org') org?: string) {
    rateLimit(this.ip(req));
    return this.service.suggestNames(q || '', org);
  }

  @Get('mine')
  @ApiOperation({ summary: 'ลืมเลขอ้างอิง: ค้นเรื่องของตัวเองด้วยชื่อ-สกุล' })
  mine(@Req() req: Request, @Query('name') name: string, @Query('org') org?: string) {
    rateLimit(this.ip(req));
    return this.service.listMine(name, org);
  }

  @Get('status')
  @ApiOperation({ summary: 'เช็กสถานะเรื่องด้วยเลขอ้างอิง + เบอร์' })
  status(@Req() req: Request, @Query('refNo') refNo: string, @Query('phone') phone: string, @Query('org') org?: string) {
    rateLimit(this.ip(req));
    return this.service.statusByRef(refNo, phone, org);
  }
}
