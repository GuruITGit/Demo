import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CitizenReportService } from './citizen-report.service';
import { PdfService } from '../pdf/pdf.service';
import { UpdateReportDto, RouteReportDto, ApproveReportDto, AttachSignatureDto } from './dto/citizen-report.dto';

/**
 * กล่องคัดกรองเรื่องแจ้ง/ร้องเรียน (เจ้าหน้าที่) — ใช้สิทธิ์สารบรรณเดิม
 * ใครเห็นสารบรรณ (correspondence:read:Ticket) เห็นกล่องนี้ได้
 */
@ApiTags('citizen-report-staff')
@ApiBearerAuth('access-token')
@Controller('citizen-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CitizenReportStaffController {
  constructor(
    private readonly service: CitizenReportService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'รายการเรื่องแจ้ง/ร้องเรียน (กรองตามสถานะ)' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  list(@CurrentUser('organizationId') orgId: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list(orgId, status, page ? Number(page) : 1, limit ? Number(limit) : undefined);
  }

  // ต้องอยู่ก่อน :id — ไม่งั้น "count" ถูกมองเป็น id แล้วโดน ParseUUIDPipe ปฏิเสธ
  @Get('count')
  @ApiOperation({ summary: 'ตัวเลขบนเมนู: เรื่องที่เข้ามาหลังเวลา since (ดูล่าสุด) + รอจัดการทั้งหมด + วันนี้ + เวลาเซิร์ฟเวอร์' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  count(@CurrentUser('organizationId') orgId: string, @Query('since') since?: string) {
    return this.service.newCount(orgId, since);
  }

  // ต้องอยู่ก่อน :id (เหตุผลเดียวกับ my-queue)
  @Get('overview')
  @ApiOperation({ summary: 'ภาพรวมผู้บริหาร — เรื่องที่ยังไม่ปิดอยู่ขั้นไหน + คิวรอนายก' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  overview(@CurrentUser('organizationId') orgId: string) {
    return this.service.overview(orgId);
  }

  // ต้องอยู่ก่อน :id เหมือน count — ไม่งั้น "my-queue" ถูกมองเป็น id แล้วโดน ParseUUIDPipe ปฏิเสธ
  @Get('my-queue')
  @ApiOperation({ summary: 'แท็บ "รอฉันเซ็น" — เรื่องที่ถึงตาผู้ใช้คนนี้พอดี (หัวหน้ากองเป้าหมาย/บทบาทปลัด/บทบาทนายก)' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  myQueue(@CurrentUser('organizationId') orgId: string, @CurrentUser() user: { id: string; roles?: string[] }) {
    return this.service.myQueue(orgId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'รายละเอียดเรื่อง' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.detail(id, orgId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'อัปเดตสถานะ / บันทึกการดำเนินการ' })
  @RequirePermissions({ module: 'complaint', action: 'manage', subject: 'Report' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDto,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string, @CurrentUser('roles') roles: string[]) {
    return this.service.update(id, dto, orgId, userId, roles);
  }

  // ─────────── ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) — คนละกลไกกับสารบรรณทั้งหมด ───────────

  @Patch(':id/route')
  @ApiOperation({ summary: 'admin กลาง "ส่งไปกองเพื่ออนุมัติ" — เลือกกอง เริ่มขั้นตอนอนุมัติ 3 ผู้เซ็น' })
  @RequirePermissions({ module: 'complaint', action: 'manage', subject: 'Report' })
  route(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RouteReportDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.routeToDept(id, dto.targetDeptId, orgId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'เซ็น/อนุมัติขั้นที่ถึงตาปัจจุบัน (ผอ.กอง/ปลัด/นายก แล้วแต่ว่าใครกำลังถึงตา) — แนบรูปลายเซ็นได้ไม่บังคับ' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveReportDto, @CurrentUser('organizationId') orgId: string,
    @CurrentUser() user: { id: string; roles?: string[] }) {
    return this.service.approveStep(id, orgId, user, dto.signatureImage);
  }

  @Patch(':id/signature')
  @ApiOperation({ summary: 'แนบ/ลบรูปลายเซ็นลงเอกสาร — เฉพาะช่องของตัวเอง (ผอ.กองที่ถูกมอบหมาย/ปลัด/นายก) ไม่เปลี่ยนสถานะอนุมัติ' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  attachSignature(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AttachSignatureDto, @CurrentUser('organizationId') orgId: string,
    @CurrentUser() user: { id: string; roles?: string[] }) {
    return this.service.attachSignature(id, orgId, user, dto.slot, dto.signatureImage);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'นายก/รองนายกปิดเรื่องเป็น "เสร็จสิ้น" ตรง ๆ (เรื่องที่ยังไม่ได้ส่งไปกอง)' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('roles') roles: string[]) {
    return this.service.closeAsMayor(id, orgId, roles);
  }

  @Get(':id/petition-pdf')
  @ApiOperation({ summary: 'พิมพ์คำร้อง (PDF) — "เรื่องทั่วไป" และ "ขอใช้บริการ" ใช้แบบฟอร์มเดียวกัน พร้อมสถานะลงนาม 3 ผู้เซ็น' })
  @RequirePermissions({ module: 'complaint', action: 'read', subject: 'Report' })
  async petitionPdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    const { report, org, signers } = await this.service.petitionPdfData(id, orgId);
    const html = this.pdf.generatePetitionHtml(report, org, signers);
    const buffer = await this.pdf.generateFromHtml(html, { margin: PdfService.PETITION_MARGIN });
    const utf8Name = encodeURIComponent(`${report.refNo}-คำร้องทั่วไป.pdf`);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="petition.pdf"; filename*=UTF-8''${utf8Name}`,
    });
    res.send(buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบเรื่อง (สิทธิ์ลบร้องเรียน — ใช้ล้างข้อมูลทดสอบ)' })
  @RequirePermissions({ module: 'complaint', action: 'delete', subject: 'Report' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.remove(id, orgId);
  }
}
