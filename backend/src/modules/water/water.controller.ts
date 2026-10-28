import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, Res, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { WaterService } from './water.service';
import { WaterAuthGuard, WaterCapGuard } from './auth/water-auth.guard';
import { RequireWaterCap } from './auth/water-cap.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateWaterCustomerDto, UpdateWaterCustomerDto, WaterCustomerQueryDto, BulkUnitPriceDto,
  CreateWaterNoticeDto, WaterNoticeQueryDto, SaveCollectionDto, CollectionQueryDto,
  SaveWaterApplicationDto,
} from './dto/water.dto';

@ApiTags('water')
@ApiBearerAuth('access-token')
@Controller('water')
@UseGuards(WaterAuthGuard, WaterCapGuard)
export class WaterController {
  constructor(private readonly service: WaterService) {}

  // ── ทะเบียนผู้ใช้น้ำ (ใช้เลือกชื่อตอนกรอกหนังสือ)
  @Get('customers')
  @ApiOperation({ summary: 'ทะเบียนผู้ใช้น้ำ (ค้นหาด้วยรหัส/ชื่อ · กรองตามหมู่)' })
  @RequireWaterCap('customers', 'reading', 'payment', 'reports')
  findCustomers(@CurrentUser('organizationId') orgId: string, @Query() dto: WaterCustomerQueryDto) {
    return this.service.findCustomers(orgId, dto);
  }

  @Get('customers/villages')
  @ApiOperation({ summary: 'รายการหมู่ที่มีผู้ใช้น้ำ พร้อมจำนวนราย' })
  @RequireWaterCap('customers', 'reading', 'payment', 'reports')
  villages(@CurrentUser('organizationId') orgId: string) {
    return this.service.villages(orgId);
  }

  @Get('customers/map')
  @ApiOperation({ summary: 'จุดพิกัดมาตรวัดน้ำ (GIS) — ผู้ใช้น้ำที่มี GPS' })
  @RequireWaterCap('customers', 'reports')
  mapPoints(@CurrentUser('organizationId') orgId: string, @Query('villageNo') villageNo?: string) {
    return this.service.mapPoints(orgId, villageNo ? Number(villageNo) : undefined);
  }

  @Get('customers/map/excel')
  @ApiOperation({ summary: 'จุดพิกัดมาตรวัดน้ำ (GIS) — Excel' })
  @RequireWaterCap('customers', 'reports')
  async mapExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response, @Query('villageNo') villageNo?: string) {
    const buffer = await this.service.mapPointsExcel(orgId, villageNo ? Number(villageNo) : undefined);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="meter-gps.xlsx"',
    });
    res.send(buffer);
  }

  @Get('customers/next-code')
  @ApiOperation({ summary: 'แนะนำรหัสผู้ใช้น้ำถัดไป (เลขมากสุด+1) — null ถ้ารหัสเดิมไม่ใช่เลขล้วน' })
  @RequireWaterCap('customers')
  nextCustomerCode(@CurrentUser('organizationId') orgId: string) {
    return this.service.suggestNextCustomerCode(orgId);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'รายละเอียดผู้ใช้น้ำ 1 ราย + ประวัติบิล' })
  @RequireWaterCap('customers', 'reading', 'payment')
  findCustomer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findCustomerDetail(id, orgId);
  }

  // ── แบบคำขอใช้น้ำ/สัญญา (ผูกกับผู้ใช้น้ำ)
  @Get('customers/:id/application')
  @ApiOperation({ summary: 'แบบคำขอใช้น้ำ/สัญญาของผู้ใช้น้ำรายนี้ (null ถ้ายังไม่มี)' })
  @RequireWaterCap('customers')
  getApplication(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.getApplication(id, orgId);
  }

  @Put('customers/:id/application')
  @ApiOperation({ summary: 'บันทึกแบบคำขอใช้น้ำ/สัญญา' })
  @RequireWaterCap('customers')
  saveApplication(
    @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveWaterApplicationDto,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string,
  ) {
    return this.service.saveApplication(id, dto, orgId, userId);
  }

  @Get('customers/:id/application/pdf')
  @ApiOperation({ summary: 'พิมพ์แบบคำขอใช้น้ำ (PDF) — kind=application|contract' })
  @RequireWaterCap('customers')
  async applicationPdf(
    @Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string,
    @Res() res: Response, @Query('kind') kind?: string,
  ) {
    const { buffer, filename } = await this.service.applicationPdf(id, orgId, kind === 'contract' ? 'contract' : 'application');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="water-application.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post('customers')
  @ApiOperation({ summary: 'เพิ่มผู้ใช้น้ำในทะเบียน' })
  @RequireWaterCap('customers')
  createCustomer(@Body() dto: CreateWaterCustomerDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.createCustomer(dto, orgId);
  }

  @Post('customers/import')
  @ApiOperation({ summary: 'นำเข้าทะเบียนผู้ใช้น้ำจากไฟล์ CSV/JSON (preview=1 = ตรวจไฟล์เฉยๆ ไม่บันทึก)' })
  @ApiConsumes('multipart/form-data')
  @RequireWaterCap('customers', 'settings')
  @UseInterceptors(FileInterceptor('file'))
  importCustomers(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('organizationId') orgId: string,
    @Query('preview') preview?: string,
  ) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');
    return this.service.importCustomers(file.buffer, file.originalname, orgId, preview === '1' || preview === 'true');
  }

  @Put('customers/bulk-rate')
  @ApiOperation({ summary: 'ตั้งราคาต่อหน่วยทีเดียวหลายคน (ทั้งหมด/ทั้งหมู่/ที่เลือก)' })
  @RequireWaterCap('customers', 'settings')
  bulkUnitPrice(@Body() dto: BulkUnitPriceDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.bulkSetUnitPrice(dto, orgId);
  }

  @Put('customers/:id')
  @ApiOperation({ summary: 'แก้ไขผู้ใช้น้ำ' })
  @RequireWaterCap('customers')
  updateCustomer(
    @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWaterCustomerDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.service.updateCustomer(id, dto, orgId);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'ลบผู้ใช้น้ำออกจากทะเบียน' })
  @RequireWaterCap('customers')
  removeCustomer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.removeCustomer(id, orgId);
  }

  // ── หนังสือแจ้งค้างชำระ
  @Get('notices')
  @ApiOperation({ summary: 'รายการหนังสือแจ้งค้างชำระที่ออกไปแล้ว' })
  @RequireWaterCap('notices', 'reports')
  findNotices(@CurrentUser('organizationId') orgId: string, @Query() dto: WaterNoticeQueryDto) {
    return this.service.findNotices(orgId, dto);
  }

  @Get('notices/next-number')
  @ApiOperation({ summary: 'เลขที่หนังสือถัดไปของปีนั้น' })
  @RequireWaterCap('notices')
  nextNumber(@CurrentUser('organizationId') orgId: string, @Query('year') year?: string) {
    return this.service.nextDocNumber(orgId, year ? Number(year) : undefined);
  }

  @Get('notices/summary')
  @ApiOperation({ summary: 'สรุปจำนวน/ยอดเงินของหนังสือที่ออก แยกตามเดือน' })
  @RequireWaterCap('notices', 'reports')
  noticeSummary(@CurrentUser('organizationId') orgId: string) {
    return this.service.noticeSummary(orgId);
  }

  // ── ทวงหนี้ยกล็อต (กรองหมู่ + จำนวนเดือนค้าง)
  @Get('notices/debtors')
  @ApiOperation({ summary: 'ลูกหนี้ค้าง ≥ N เดือน (กรองหมู่) — สำหรับทวงยกล็อต' })
  @RequireWaterCap('notices', 'reports')
  debtors(@CurrentUser('organizationId') orgId: string, @Query('villageNo') villageNo?: string, @Query('minMonths') minMonths?: string) {
    return this.service.debtorsForDunning(orgId, villageNo ? Number(villageNo) : undefined, minMonths ? Number(minMonths) : 1);
  }

  @Get('notices/bulk-pdf')
  @ApiOperation({ summary: 'พิมพ์หนังสือแจ้งเตือนยกล็อต (PDF หลายฉบับ)' })
  @RequireWaterCap('notices')
  async bulkNotice(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('villageNo') villageNo?: string, @Query('minMonths') minMonths?: string, @Query('noticeDate') noticeDate?: string) {
    const { buffer, filename } = await this.service.bulkNoticePdf(orgId, villageNo ? Number(villageNo) : undefined,
      minMonths ? Number(minMonths) : 1, noticeDate || new Date().toISOString().slice(0, 10));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="water-notice-bulk.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Content-Length': String(buffer.length) });
    res.end(buffer);
  }

  @Get('notices/bulk-envelope')
  @ApiOperation({ summary: 'พิมพ์หน้าซองยกล็อต (PDF หลายซอง)' })
  @RequireWaterCap('notices')
  async bulkEnvelope(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('villageNo') villageNo?: string, @Query('minMonths') minMonths?: string) {
    const { buffer, filename } = await this.service.bulkEnvelopePdf(orgId, villageNo ? Number(villageNo) : undefined, minMonths ? Number(minMonths) : 1);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="water-envelope-bulk.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Content-Length': String(buffer.length) });
    res.end(buffer);
  }

  @Get('notices/:id')
  @ApiOperation({ summary: 'หนังสือฉบับเดียว (ใช้พิมพ์ซ้ำ)' })
  @RequireWaterCap('notices')
  findNotice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findNotice(id, orgId);
  }

  @Get('notices/:id/pdf')
  @ApiOperation({ summary: 'ดาวน์โหลดหนังสือเป็น PDF (เรนเดอร์ที่ server ได้กระดาษเหมือนกันทุกเครื่อง)' })
  @RequireWaterCap('notices')
  async noticePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.noticePdf(id, orgId);
    // อักษรไทยใน HTTP header ไม่ได้ → ใช้ filename*=UTF-8'' + ชื่อ ASCII สำรอง
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="water-notice.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Get('notices/:id/envelope')
  @ApiOperation({ summary: 'พิมพ์หน้าซองจดหมายส่งใบเตือน (ผู้ส่ง อบต. + ผู้รับ ผู้ใช้น้ำ)' })
  @RequireWaterCap('notices')
  async noticeEnvelope(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.noticeEnvelopePdf(id, orgId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="water-envelope.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post('notices')
  @ApiOperation({ summary: 'ออกหนังสือแจ้งค้างชำระ (รันเลขที่ให้อัตโนมัติ)' })
  @RequireWaterCap('notices')
  createNotice(
    @Body() dto: CreateWaterNoticeDto,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string,
  ) {
    return this.service.createNotice(dto, orgId, userId);
  }

  @Delete('notices/:id')
  @ApiOperation({ summary: 'ลบหนังสือ (กรณีออกผิด)' })
  @RequireWaterCap('notices')
  removeNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string,
  ) {
    return this.service.removeNotice(id, orgId, userId);
  }

  // ── สรุปการเก็บค่าน้ำ (dashboard)
  @Get('collection/dashboard')
  @ApiOperation({ summary: 'ข้อมูล dashboard สรุปการเก็บค่าน้ำ (งวดล่าสุด หรือระบุ year/month)' })
  @RequireWaterCap('reports')
  collectionDashboard(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year?: string, @Query('month') month?: string,
  ) {
    return this.service.collectionDashboard(orgId, year ? Number(year) : undefined, month ? Number(month) : undefined);
  }

  @Get('collection/periods')
  @ApiOperation({ summary: 'รายการงวดที่มีข้อมูลการเก็บค่าน้ำ' })
  @RequireWaterCap('reports')
  collectionPeriods(@CurrentUser('organizationId') orgId: string) {
    return this.service.collectionPeriods(orgId);
  }

  @Get('collection')
  @ApiOperation({ summary: 'ตัวเลขรายหมู่ของงวดหนึ่ง (สำหรับหน้ากรอก)' })
  @RequireWaterCap('reports', 'settings')
  getCollection(@CurrentUser('organizationId') orgId: string, @Query() dto: CollectionQueryDto) {
    return this.service.getCollection(orgId, dto);
  }

  @Post('collection')
  @ApiOperation({ summary: 'บันทึกตัวเลขการเก็บค่าน้ำของทั้งงวด' })
  @RequireWaterCap('settings')
  saveCollection(@Body() dto: SaveCollectionDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.saveCollection(dto, orgId);
  }
}
