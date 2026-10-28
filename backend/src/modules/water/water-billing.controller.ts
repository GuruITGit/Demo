import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, ParseUUIDPipe, Res, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { WaterBillingService } from './water-billing.service';
import { WaterAuthGuard, WaterCapGuard } from './auth/water-auth.guard';
import { RequireWaterCap } from './auth/water-cap.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PeriodQueryDto, SaveReadingDto, ReceivePaymentDto, CancelPaymentDto, UpdateRateDto, PayBillsDto, ReconcileDto } from './dto/water.dto';

/**
 * ระบบเก็บค่าน้ำ v2 (field app จดมิเตอร์ → บิล → รับชำระ)
 * สิทธิ์ v1: อ่าน = water:read:WaterNotice, เขียน = water:manage:WaterCustomer
 * (ยังไม่เพิ่ม permission เฉพาะ — ทำก่อน deploy prod)
 */
@ApiTags('water-billing')
@ApiBearerAuth('access-token')
@Controller('water/billing')
@UseGuards(WaterAuthGuard, WaterCapGuard)
export class WaterBillingController {
  constructor(private readonly service: WaterBillingService) {}

  @Get('rate')
  @ApiOperation({ summary: 'เรตค่าน้ำปัจจุบัน' })
  async getRate(@CurrentUser('organizationId') orgId: string) {
    const rate = await this.service.getRate(orgId);
    // ไม่ส่ง token ตรวจสลิป (secret) กลับ frontend — ส่งแค่ชื่อผู้ให้บริการ + สถานะว่าตั้งไว้แล้วหรือยัง
    const { slipVerifyToken, slipVerifyProviders, ...safe } = rate as any;
    const list = (Array.isArray(slipVerifyProviders) ? slipVerifyProviders : []).filter((p: any) => p?.provider && p?.token);
    return {
      ...safe,
      // ชื่อเจ้าอย่างเดียว (ไม่มี token) ให้หน้าตั้งค่าแสดงลำดับการใช้งาน
      slipVerifyList: list.map((p: any) => ({ provider: p.provider, hasToken: true })),
      slipVerifyConfigured: list.length > 0 || !!slipVerifyToken,
    };
  }

  @Put('rate')
  @ApiOperation({ summary: 'ตั้งค่าเรตค่าน้ำ (ราคา/หน่วย + ค่าบริการ)' })
  @RequireWaterCap('settings')
  updateRate(@Body() dto: UpdateRateDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.updateRate(orgId, dto);
  }

  @Get('round')
  @ApiOperation({ summary: 'รอบบิลปัจจุบัน (งวดที่กำลังจด/เก็บ) + ความคืบหน้า' })
  @RequireWaterCap('reading', 'settings')
  getRound(@CurrentUser('organizationId') orgId: string) {
    return this.service.getRound(orgId);
  }

  @Post('round')
  @ApiOperation({ summary: 'เปลี่ยนรอบบิล — เลื่อนเดือนถัดไป (หรือกำหนด year/month)' })
  @RequireWaterCap('settings')
  setRound(@CurrentUser('organizationId') orgId: string, @Body() body: { year?: number; month?: number }) {
    return this.service.setRound(orgId, body?.year ? Number(body.year) : undefined, body?.month ? Number(body.month) : undefined);
  }

  @Get('remittance')
  @ApiOperation({ summary: 'ประวัติรอบส่งเงินประจำวัน' })
  @RequireWaterCap('payment', 'settings', 'reports')
  listRemittance(@CurrentUser('organizationId') orgId: string) {
    return this.service.listRemittance(orgId);
  }

  @Post('remittance')
  @ApiOperation({ summary: 'ปิดรอบส่งเงินของวัน (snapshot ยอดเงินรับ)' })
  @RequireWaterCap('payment', 'settings')
  closeRemittance(@CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string, @Body() body: { date: string; note?: string }) {
    return this.service.closeRemittance(orgId, body?.date, userId, body?.note);
  }

  @Get('verify')
  @ApiOperation({ summary: 'ตรวจสอบการจดมิเตอร์ก่อนปิดรอบ (สูงผิดปกติ/มิเตอร์คงที่/เบี่ยงเบน ≥30%)' })
  @RequireWaterCap('reports', 'reading')
  verify(@CurrentUser('organizationId') orgId: string,
    @Query('year') year: string, @Query('month') month: string,
    @Query('threshold') threshold?: string, @Query('devPct') devPct?: string) {
    return this.service.verifyReadings(orgId, Number(year), Number(month),
      threshold ? Number(threshold) : 100, devPct ? Number(devPct) : 30);
  }

  @Get('verify/excel')
  @ApiOperation({ summary: 'ตรวจสอบการจดมิเตอร์ก่อนปิดรอบ — Excel (3 ชีต)' })
  @RequireWaterCap('reports', 'reading')
  async verifyExcel(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('year') year: string, @Query('month') month: string,
    @Query('threshold') threshold?: string, @Query('devPct') devPct?: string) {
    const buffer = await this.service.verifyExcel(orgId, Number(year), Number(month),
      threshold ? Number(threshold) : 100, devPct ? Number(devPct) : 30);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="verify-water-${month}-${year}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('qr-amount')
  @ApiOperation({ summary: 'QR พร้อมเพย์สำหรับยอดรวม (รับชำระหลายบิลหน้า cashier)' })
  @RequireWaterCap('payment')
  qrAmount(@CurrentUser('organizationId') orgId: string, @Query('amount') amount: string) {
    return this.service.qrForAmount(orgId, Number(amount));
  }

  @Get('next-receipt-no')
  @ApiOperation({ summary: 'ดูเลขที่ใบเสร็จถัดไป (ไม่กิน sequence)' })
  @RequireWaterCap('payment')
  nextReceipt(@CurrentUser('organizationId') orgId: string) {
    return this.service.peekNextReceiptNo(orgId);
  }

  @Get('routes')
  @ApiOperation({ summary: 'รายหมู่/เส้นทาง พร้อมความคืบหน้าการจด/เก็บของงวด' })
  @RequireWaterCap('reading', 'payment')
  routes(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string) {
    return this.service.routes(orgId, Number(year), Number(month));
  }

  @Get('members')
  @ApiOperation({ summary: 'รายชื่อผู้ใช้น้ำในหมู่ + บิลของงวด (สำหรับหน้าจด)' })
  @RequireWaterCap('reading', 'payment')
  members(@CurrentUser('organizationId') orgId: string, @Query() dto: PeriodQueryDto) {
    return this.service.routeMembers(orgId, dto);
  }

  @Post('reading')
  @ApiOperation({ summary: 'บันทึกจดมิเตอร์ → คิดเงินอัตโนมัติ → ออกบิล (ค้างชำระ)' })
  @RequireWaterCap('reading')
  saveReading(@Body() dto: SaveReadingDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.saveReading(dto, orgId, userId);
  }

  @Get('print-test')
  @ApiOperation({ summary: 'ใบทดสอบพิมพ์ 58mm (ESC/POS base64) — ให้เจ้าหน้าที่ยิงเช็คว่าต่อเครื่องพิมพ์ติด ไม่ต้องมีบิลจริง' })
  @RequireWaterCap('reading', 'payment', 'settings')
  printTest(@CurrentUser('organizationId') orgId: string) {
    return this.service.printTestEscpos(orgId);
  }

  @Get('blue-receipt/test')
  @ApiOperation({ summary: 'ใบเสร็จสีฟ้า — ใบทดสอบตำแหน่งพิมพ์ (ข้อมูลสมมติ 3 ใบ)' })
  @RequireWaterCap('payment', 'settings')
  async blueReceiptTest(@CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.blueReceiptTestPdf(orgId);
    this.sendPdf(res, buffer, filename, 'blue-receipt-test.pdf');
  }

  @Get(':id')
  @ApiOperation({ summary: 'บิลค่าน้ำ 1 ใบ' })
  @RequireWaterCap('reading', 'payment')
  getBill(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findBill(id, orgId);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'ใบแจ้งหนี้ค่าน้ำ (PDF 58mm) — พิมพ์ตอนจดมิเตอร์' })
  @RequireWaterCap('reading', 'payment')
  async invoice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.billInvoicePdf(id, orgId);
    this.sendPdf(res, buffer, filename, 'water-invoice.pdf');
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'ใบเสร็จรับเงินค่าน้ำ (PDF 58mm)' })
  @RequireWaterCap('payment', 'reading')
  async receipt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.billReceiptPdf(id, orgId);
    this.sendPdf(res, buffer, filename, 'water-receipt.pdf');
  }

  @Get(':id/blue-receipt')
  @ApiOperation({ summary: 'ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง ฟอร์มพิมพ์สำเร็จ) — 1 ใบ' })
  @RequireWaterCap('payment', 'reports')
  async blueReceipt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.blueReceiptPdf(id, orgId);
    this.sendPdf(res, buffer, filename, 'blue-receipt.pdf');
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'QR พร้อมเพย์ของบิล (ยอดตรงบิล) — โชว์ให้ผู้ใช้น้ำสแกนจ่ายที่จุดรับเงิน' })
  @RequireWaterCap('payment')
  billQr(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.billQr(id, orgId);
  }

  @Get(':id/slip-escpos')
  @ApiOperation({ summary: 'ใบเสร็จ/ใบแจ้งหนี้ 58mm เป็น ESC/POS raster (base64) สำหรับ RawBT → PT-210 — kind=invoice|receipt' })
  @RequireWaterCap('reading', 'payment')
  slipEscpos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string,
    @Query('kind') kind?: string, @Query('copies') copies?: string) {
    return this.service.billSlipEscpos(id, orgId, kind === 'invoice' ? 'invoice' : 'receipt', Number(copies) || 1);
  }

  private sendPdf(res: Response, buffer: Buffer, filename: string, ascii: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'รับชำระเงินบิล' })
  @RequireWaterCap('payment')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceivePaymentDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.receivePayment(id, dto, orgId, userId);
  }

  @Post('pay-bills')
  @ApiOperation({ summary: 'รับชำระหลายบิลพร้อมกัน (cashier สำนักงาน) — เลขใบเสร็จเดียวทั้งชุด' })
  @RequireWaterCap('payment')
  payBills(@Body() dto: PayBillsDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.payBills(dto.customerId, dto.billIds, { payMethod: dto.payMethod, receiptNo: dto.receiptNo, slipVerifyId: dto.slipVerifyId }, orgId, userId);
  }

  @Post('verify-slip')
  @ApiOperation({ summary: 'ตรวจสลิปหน้างานสำหรับชุดบิลที่เลือก (เจ้าหน้าที่ถ่าย/สแกนสลิปลูกค้า) → ได้ verifyId ไปกดรับชำระ' })
  @ApiConsumes('multipart/form-data')
  @RequireWaterCap('payment')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)), // รูปเท่านั้น (override ฟิลเตอร์ csv/json ของโมดูล)
  }))
  verifySlipForBills(
    @UploadedFile() file: Express.Multer.File,
    @Body('billIds') billIds: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปสลิป');
    let ids: string[] = [];
    try { ids = Array.isArray(billIds) ? billIds : JSON.parse(billIds || '[]'); } catch { ids = String(billIds || '').split(',').filter(Boolean); }
    return this.service.verifySlipForBills(orgId, userId, ids, file);
  }

  @Post('reconcile/parse')
  @ApiOperation({ summary: 'อ่านไฟล์ statement ธนาคาร (Excel/CSV) → คืนหัวตาราง+แถว ให้หน้าเว็บ map คอลัมน์' })
  @RequireWaterCap('payment')
  @UseInterceptors(FileInterceptor('file'))
  parseReconcile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('ไม่พบไฟล์ที่อัปโหลด');
    return this.service.parseReconcileFile(file.buffer, file.originalname);
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'กระทบยอดจากไฟล์ธนาคาร (KTB Bill Payment) — จับคู่ Ref1/Ref2+ยอด → ตัดชำระ+ออกใบเสร็จ (dryRun=พรีวิว)' })
  @RequireWaterCap('payment')
  reconcile(@Body() dto: ReconcileDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.reconcile(orgId, userId, dto.rows, dto.dryRun ?? true);
  }

  @Post(':id/cancel-pay')
  @ApiOperation({ summary: 'ยกเลิกการรับชำระ (รับผิด) — ต้องระบุเหตุผล + บันทึก audit' })
  @RequireWaterCap('payment')
  cancelPay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelPaymentDto,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.cancelPayment(id, dto, orgId, userId);
  }

  @Post(':id/meter-photo')
  @ApiOperation({ summary: 'อัปโหลดรูปมาตรวัดน้ำ (หลักฐานการจด)' })
  @RequireWaterCap('reading')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)), // รูปเท่านั้น (override ฟิลเตอร์ csv/json ของโมดูล)
  }))
  meterPhoto(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File,
    @CurrentUser('organizationId') orgId: string) {
    return this.service.saveMeterPhoto(id, orgId, file);
  }

  @Get('alerts/list')
  @ApiOperation({ summary: 'แจ้งเตือนหน้างาน: มิเตอร์เสีย(0 หน่วย) / ท่อรั่ว(ใช้เกินเกณฑ์) ของงวด' })
  @RequireWaterCap('reports', 'reading')
  alerts(@CurrentUser('organizationId') orgId: string,
    @Query('year') year: string, @Query('month') month: string, @Query('threshold') threshold?: string) {
    return this.service.billingAlerts(orgId, Number(year), Number(month), threshold ? Number(threshold) : 50);
  }

  @Get('issues/list')
  @ApiOperation({ summary: 'รายชื่อมาตรวัดน้ำที่แจ้งปัญหา (ชำรุด/รั่ว/บัง ฯลฯ) — ไม่ระบุงวด=ทุกงวด' })
  @RequireWaterCap('reports', 'reading')
  issues(@CurrentUser('organizationId') orgId: string,
    @Query('year') year?: string, @Query('month') month?: string, @Query('villageNo') villageNo?: string) {
    return this.service.meterIssues(orgId, year ? Number(year) : undefined, month ? Number(month) : undefined, villageNo ? Number(villageNo) : undefined);
  }

  @Get('payments/blue-receipts')
  @ApiOperation({ summary: 'ใบเสร็จสีฟ้าทั้งชุด ตามเงื่อนไขเดียวกับหน้าตรวจสอบการชำระ (หน้าละ 3 ใบ)' })
  @RequireWaterCap('reports', 'payment')
  async blueReceipts(@CurrentUser('organizationId') orgId: string, @Res() res: Response,
    @Query('search') search?: string, @Query('receiptNo') receiptNo?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    const { buffer, filename } = await this.service.blueReceiptsPdf(orgId, { search, receiptNo, from, to });
    this.sendPdf(res, buffer, filename, 'blue-receipts.pdf');
  }

  @Get('payments/history')
  @ApiOperation({ summary: 'ตรวจสอบ/ค้นประวัติการชำระเงิน (ชื่อ/รหัส/เลขใบเสร็จ + ช่วงวัน)' })
  @RequireWaterCap('reports', 'payment')
  paymentHistory(@CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string, @Query('receiptNo') receiptNo?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.paymentHistory(orgId, { search, receiptNo, from, to });
  }

  @Get('daily/report')
  @ApiOperation({ summary: 'เงินรับรายวัน แยกวัน×ผู้เก็บ (ตัวควบคุมภายใน แบบ ป.32)' })
  @RequireWaterCap('reports')
  daily(@CurrentUser('organizationId') orgId: string, @Query('year') year: string, @Query('month') month: string) {
    return this.service.dailyCollection(orgId, Number(year), Number(month));
  }

  @Get('slips/pending')
  @ApiOperation({ summary: 'สลิปโอนเงินรอตรวจ (ประชาชนแนบมา)' })
  @RequireWaterCap('slips')
  pendingSlips(@CurrentUser('organizationId') orgId: string, @Query('status') status?: string) {
    return this.service.pendingSlips(orgId, status === 'rejected' ? 'rejected' : 'pending');
  }

  @Post(':id/slip/confirm')
  @ApiOperation({ summary: 'ยืนยันสลิป → รับชำระ (qr) + ออกใบเสร็จอัตโนมัติ' })
  @RequireWaterCap('slips')
  confirmSlip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.confirmSlip(id, orgId, userId);
  }

  @Post(':id/slip/reject')
  @ApiOperation({ summary: 'ปฏิเสธสลิป (ระบุเหตุผล) — คงค้างชำระ' })
  @RequireWaterCap('slips')
  rejectSlip(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelPaymentDto,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.rejectSlip(id, dto, orgId, userId);
  }
}
