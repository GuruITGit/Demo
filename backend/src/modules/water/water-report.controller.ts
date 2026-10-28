import { Controller, Get, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaterReportService, ArMode, P32Sort } from './water-report.service';
import { WaterAuthGuard, WaterCapGuard } from './auth/water-auth.guard';
import { RequireWaterCap } from './auth/water-cap.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** รายงานราชการกองการประปา — ป.17 บัญชีลูกหนี้ · ป.32 เงินรายรับ (หน้าจอ + Excel + PDF) */
@ApiTags('water-report')
@ApiBearerAuth('access-token')
@Controller('water/report')
@UseGuards(WaterAuthGuard, WaterCapGuard)
export class WaterReportController {
  constructor(private readonly service: WaterReportService) {}

  private parse(year?: string, month?: string) {
    const y = Number(year), m = Number(month);
    if (!y || !m || m < 1 || m > 12) throw new BadRequestException('กรุณาระบุปี (พ.ศ.) และเดือนให้ถูกต้อง');
    return { y, m };
  }
  private mode(v?: string): ArMode { return v === 'outstanding' ? 'outstanding' : 'period'; }
  private village(v?: string) { const n = Number(v); return n && n > 0 ? n : undefined; }

  private sendXlsx(res: Response, buffer: Buffer, name: string) {
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
  private sendPdf(res: Response, buffer: Buffer, name: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ── ป.17 บัญชีลูกหนี้ค่าน้ำ
  @Get('ar')
  @ApiOperation({ summary: 'ป.17 บัญชีลูกหนี้ค่าน้ำ (รายลูกหนี้ + สรุปหมู่) — mode=period|outstanding' })
  @RequireWaterCap('reports')
  ar(@CurrentUser('organizationId') orgId: string,
     @Query('year') year: string, @Query('month') month: string,
     @Query('mode') mode?: string, @Query('villageNo') villageNo?: string) {
    const { y, m } = this.parse(year, month);
    return this.service.arLedger(orgId, y, m, this.mode(mode), this.village(villageNo));
  }

  @Get('ar/excel')
  @ApiOperation({ summary: 'ป.17 บัญชีลูกหนี้ค่าน้ำ — Excel' })
  @RequireWaterCap('reports')
  async arExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('year') year: string, @Query('month') month: string,
    @Query('mode') mode?: string, @Query('villageNo') villageNo?: string) {
    const { y, m } = this.parse(year, month);
    const buffer = await this.service.arLedgerExcel(orgId, y, m, this.mode(mode), this.village(villageNo));
    this.sendXlsx(res, buffer, `บัญชีลูกหนี้ค่าน้ำ-ป17-${m}-${y}.xlsx`);
  }

  @Get('ar/pdf')
  @ApiOperation({ summary: 'ป.17 บัญชีลูกหนี้ค่าน้ำ — PDF (ฟอร์มราชการ)' })
  @RequireWaterCap('reports')
  async arPdf(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('year') year: string, @Query('month') month: string,
    @Query('mode') mode?: string, @Query('villageNo') villageNo?: string) {
    const { y, m } = this.parse(year, month);
    const { buffer, filename } = await this.service.arLedgerPdf(orgId, y, m, this.mode(mode), this.village(villageNo));
    this.sendPdf(res, buffer, filename);
  }

  // ── รายงานการใช้น้ำรายผู้ใช้
  @Get('usage')
  @ApiOperation({ summary: 'รายงานการใช้น้ำ (หน่วยรายหมู่ + รายผู้ใช้ เทียบเดือนก่อน)' })
  @RequireWaterCap('reports')
  usage(@CurrentUser('organizationId') orgId: string,
    @Query('year') year: string, @Query('month') month: string, @Query('villageNo') villageNo?: string) {
    const { y, m } = this.parse(year, month);
    return this.service.usageReport(orgId, y, m, this.village(villageNo));
  }

  @Get('usage/excel')
  @ApiOperation({ summary: 'รายงานการใช้น้ำ — Excel' })
  @RequireWaterCap('reports')
  async usageExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('year') year: string, @Query('month') month: string, @Query('villageNo') villageNo?: string) {
    const { y, m } = this.parse(year, month);
    const buffer = await this.service.usageExcel(orgId, y, m, this.village(villageNo));
    this.sendXlsx(res, buffer, `รายงานการใช้น้ำ-${m}-${y}.xlsx`);
  }

  // ── ป.32 รายงานเงินรายรับ
  @Get('p32')
  @ApiOperation({ summary: 'ป.32 รายงานเงินรายรับค่าน้ำ (แยกวัน×ผู้รับเงิน + ประเภทเงิน)' })
  @RequireWaterCap('reports')
  p32(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    return this.service.p32(orgId, y, m);
  }

  @Get('p32/excel')
  @ApiOperation({ summary: 'ป.32 รายงานเงินรายรับ — Excel' })
  @RequireWaterCap('reports')
  async p32Excel(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    const buffer = await this.service.p32Excel(orgId, y, m);
    this.sendXlsx(res, buffer, `รายงานเงินรายรับค่าน้ำ-ป32-${m}-${y}.xlsx`);
  }

  @Get('p32/pdf')
  @ApiOperation({ summary: 'ป.32 รายงานเงินรายรับ — PDF (ฟอร์มราชการ)' })
  @RequireWaterCap('reports')
  async p32Pdf(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    const { buffer, filename } = await this.service.p32Pdf(orgId, y, m);
    this.sendPdf(res, buffer, filename);
  }

  // ── ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) — เรียงได้ตามเลขที่ใบเสร็จ/วันที่/ผู้รับเงิน
  private parseSort(sort?: string): P32Sort {
    return sort === 'date' || sort === 'collector' ? sort : 'receipt';
  }

  @Get('p32/register')
  @ApiOperation({ summary: 'ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ)' })
  @RequireWaterCap('reports')
  p32Register(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string, @Query('sort') sort?: string) {
    const { y, m } = this.parse(year, month);
    return this.service.p32Register(orgId, y, m, this.parseSort(sort));
  }

  @Get('p32/register/excel')
  @ApiOperation({ summary: 'ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) — Excel' })
  @RequireWaterCap('reports')
  async p32RegisterExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string, @Query('sort') sort?: string) {
    const { y, m } = this.parse(year, month);
    const buffer = await this.service.p32RegisterExcel(orgId, y, m, this.parseSort(sort));
    this.sendXlsx(res, buffer, `ทะเบียนรายรับค่าน้ำ-ป32-${m}-${y}.xlsx`);
  }

  @Get('p32/register/pdf')
  @ApiOperation({ summary: 'ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) — PDF (ฟอร์มราชการ)' })
  @RequireWaterCap('reports')
  async p32RegisterPdf(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string, @Query('sort') sort?: string) {
    const { y, m } = this.parse(year, month);
    const { buffer, filename } = await this.service.p32RegisterPdf(orgId, y, m, this.parseSort(sort));
    this.sendPdf(res, buffer, filename);
  }

  // ── ป.31 ทะเบียนการอ่านมาตรวัดน้ำ
  @Get('p31')
  @ApiOperation({ summary: 'ป.31 ทะเบียนการอ่านมาตรวัดน้ำ (prev/curr/หน่วยที่ใช้ รายผู้ใช้น้ำ)' })
  @RequireWaterCap('reports')
  p31(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    return this.service.p31(orgId, y, m);
  }

  @Get('p31/excel')
  @ApiOperation({ summary: 'ป.31 ทะเบียนการอ่านมาตรวัดน้ำ — Excel' })
  @RequireWaterCap('reports')
  async p31Excel(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    this.sendXlsx(res, await this.service.p31Excel(orgId, y, m), `ทะเบียนอ่านมาตร-ป31-${m}-${y}.xlsx`);
  }

  @Get('p31/pdf')
  @ApiOperation({ summary: 'ป.31 ทะเบียนการอ่านมาตรวัดน้ำ — PDF' })
  @RequireWaterCap('reports')
  async p31Pdf(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    const { buffer, filename } = await this.service.p31Pdf(orgId, y, m);
    this.sendPdf(res, buffer, filename);
  }

  // ── รายงานภาษีขาย (VAT)
  @Get('vat')
  @ApiOperation({ summary: 'รายงานภาษีขาย (ภาษีมูลค่าเพิ่ม) — รายใบเสร็จ + สรุป' })
  @RequireWaterCap('reports')
  vat(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    return this.service.vat(orgId, y, m);
  }

  @Get('vat/excel')
  @ApiOperation({ summary: 'รายงานภาษีขาย (VAT) — Excel' })
  @RequireWaterCap('reports')
  async vatExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    this.sendXlsx(res, await this.service.vatExcel(orgId, y, m), `รายงานภาษีขาย-VAT-${m}-${y}.xlsx`);
  }

  @Get('vat/pdf')
  @ApiOperation({ summary: 'รายงานภาษีขาย (VAT) — PDF' })
  @RequireWaterCap('reports')
  async vatPdf(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('year') year: string, @Query('month') month: string) {
    const { y, m } = this.parse(year, month);
    const { buffer, filename } = await this.service.vatPdf(orgId, y, m);
    this.sendPdf(res, buffer, filename);
  }
}
