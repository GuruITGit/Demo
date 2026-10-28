import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, ParseIntPipe, Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { TicketService } from './ticket.service';
import { TicketNumberingService } from './ticket-numbering.service';
import { TicketSummaryService } from './ticket-summary.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/ticket.dto';
import {
  CreateTicketV4Dto, UpdateTicketV4Dto, TicketActionV4Dto, ReturnV4Dto,
} from './dto/ticket-v4.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('correspondence-tickets')
@ApiBearerAuth('access-token')
@Controller('correspondence/tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TicketController {
  constructor(
    private readonly service: TicketService,
    private readonly numbering: TicketNumberingService,
    private readonly summary: TicketSummaryService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายการสารบรรณ (กรองตามสิทธิ์)' })
  findAll(@CurrentUser() user: any, @Query() dto: TicketQueryDto) {
    return this.service.findAll(dto, user);
  }

  @Get('stats')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'สถิติสารบรรณสำหรับ Dashboard' })
  getStats(@CurrentUser() user: any) {
    return this.summary.getStats(user);
  }

  @Get('books')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายการสมุดทะเบียน (metadata) ทั้งหมด' })
  listBooks() {
    return this.numbering.listBooks();
  }

  @Get('suggestions')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ค่าที่เคยใช้ในช่อง จาก/เรียน (autocomplete)' })
  suggestions(@CurrentUser() user: any) {
    return this.service.fieldSuggestions(user);
  }

  @Get('next-number')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'เลขทะเบียนรับที่แนะนำถัดไป (ล่าสุด+1 ในสมุด/ปีนั้น)' })
  nextNumber(@CurrentUser() user: any, @Query('book') book?: string, @Query('fiscalYear') fiscalYear?: string) {
    return this.numbering.suggestNextReceiveNumber(user, book, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('books/summary')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'จำนวนเรื่องในแต่ละสมุด + ปีงบที่มีข้อมูล' })
  booksSummary(@CurrentUser() user: any, @Query('fiscalYear') fiscalYear?: string) {
    return this.numbering.booksSummary(user, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('my-tasks')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'งานสารบรรณที่รอฉันดำเนินการ' })
  myTasks(@CurrentUser() user: any) {
    return this.service.myTasks(user);
  }

  @Get('inbox')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] กล่องงานตามบทบาท (box=todo/doing/done/created) + สถานะอ่านแล้ว' })
  inbox(@CurrentUser() user: any, @Query('box') box: string, @Query() dto: TicketQueryDto) {
    return this.service.inbox(user, box || 'todo', dto);
  }

  // ── รายงานสรุปประจำเดือน (ต้องมีสิทธิ์ correspondence:summary:Ticket) ──
  @Get('overview')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: 'ภาพรวมผู้บริหาร — งานที่ยังไม่ปิดอยู่ที่ใคร ค้างกี่วัน + คิวรอนายก' })
  overview(@CurrentUser() user: any) {
    return this.summary.overview(user);
  }

  @Get('summary/years')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายงานสรุป — ปีที่มีข้อมูล + จำนวนต่อปี' })
  summaryYears(@CurrentUser() user: any) {
    return this.summary.summaryYears(user);
  }

  @Get('summary/:year/months')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายงานสรุป — จำนวนรายเดือนของปี (พ.ศ.)' })
  summaryMonths(@Param('year', ParseIntPipe) year: number, @CurrentUser() user: any) {
    return this.summary.summaryMonths(year, user);
  }

  @Get('summary/:year/year')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] รายงานสรุปรายปี — ภาพรวมทั้งปี (step/กอง/เร่งด่วน/12 เดือน)' })
  summaryYearly(@Param('year', ParseIntPipe) year: number, @Query('deptId') deptId: string, @CurrentUser() user: any) {
    return this.summary.summaryYearly(year, user, deptId || undefined);
  }

  @Get('summary/:year/year/excel')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] ส่งออกรายงานสรุปรายปีเป็น Excel' })
  async summaryYearlyExcel(@Param('year', ParseIntPipe) year: number, @Query('deptId') deptId: string, @CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.summary.summaryYearlyExcel(year, user, deptId || undefined);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="saraban-summary-${year}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('summary/:year/:month')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] รายงานสรุปรายเดือน — dashboard (step/กอง/เร่งด่วน) + รายการ' })
  summaryMonthly(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query('deptId') deptId: string,
    @CurrentUser() user: any,
  ) {
    return this.summary.summaryMonthly(year, month, user, deptId || undefined);
  }

  @Get('summary/:year/:month/excel')
  @RequirePermissions({ module: 'correspondence', action: 'summary', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] ส่งออกรายงานสรุปรายเดือนเป็น Excel' })
  async summaryMonthlyExcel(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Query('deptId') deptId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.summary.summaryMonthlyExcel(year, month, user, deptId || undefined);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="saraban-summary-${year}-${month}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('returned')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'กล่องหนังสือตีกลับ (แยกรับ/ส่ง) — ข้อ 6' })
  returnedInbox(@CurrentUser() user: any) {
    return this.service.returnedInbox(user);
  }

  @Get('statistics')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายงานสถิติทะเบียน (ตามเล่ม/กอง/เดือน) — ข้อ 8' })
  statistics(@CurrentUser() user: any, @Query('fiscalYear') fiscalYear?: string) {
    return this.summary.statistics(user, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('statistics/export')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ส่งออกรายงานสถิติเป็น Excel — ข้อ 8' })
  async statisticsExport(@CurrentUser() user: any, @Query('fiscalYear') fiscalYear: string, @Res() res: Response) {
    const buffer = await this.summary.statisticsExcel(user, fiscalYear ? Number(fiscalYear) : undefined);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="saraban-statistics-${fiscalYear || 'all'}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('report')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายงานสรุปสารบรรณ' })
  report(@CurrentUser() user: any) {
    return this.summary.report(user);
  }

  @Get('export/excel')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ส่งออกรายการสารบรรณเป็น Excel (ตามผลค้นหา)' })
  async exportExcel(@CurrentUser() user: any, @Query() dto: TicketQueryDto, @Res() res: Response) {
    const buffer = await this.summary.exportExcel(dto, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="saraban-${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('export/pdf')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ส่งออกรายการสารบรรณเป็น PDF (ตามผลค้นหา)' })
  async exportListPdf(@CurrentUser() user: any, @Query() dto: TicketQueryDto, @Res() res: Response) {
    const rows = await this.summary.findForExport(dto, user);
    const org = (rows[0] as any)?.organization;
    const html = this.pdf.generateTicketListHtml(rows, org);
    const buffer = await this.pdf.generateFromHtml(html);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="saraban-list-${Date.now()}.pdf"` });
    res.send(buffer);
  }

  @Get('signatures/history')
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'ประวัติการลงนาม (ลายเซ็นที่วาดสด)' })
  getSigningHistory(@CurrentUser('organizationId') orgId: string) {
    return this.service.getSigningHistory(orgId);
  }

  @Get('signatures/my')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ประวัติการลงนามของฉัน (โปรไฟล์)' })
  getMySigningHistory(@CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.getMySigningHistory(orgId, userId);
  }

  @Get(':id')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'รายละเอียดสารบรรณ + ประวัติการทำงาน + ไฟล์แนบ (+ statusLabel/ฟิลด์ v4)' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.findOneV4(id, user);
  }

  @Get(':id/pdf')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ส่งออก PDF หนังสือสารบรรณ (พร้อมลายเซ็น)' })
  async exportPdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Res() res: Response) {
    const ticket: any = await this.service.findOne(id, user);
    const emblem = await this.pdf.resolveOrgEmblem(ticket.organization);
    const html = this.pdf.generateTicketHtml(ticket, ticket.organization, emblem);
    const buffer = await this.pdf.generateFromHtml(html);
    // เลขสารบรรณมีอักษรไทย (ปล/สป/กค ...) ใส่ตรงๆ ใน header ไม่ได้ — ใช้ filename* (RFC 5987) + ASCII fallback
    const utf8Name = encodeURIComponent(`${ticket.ticketNumber}.pdf`);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="saraban.pdf"; filename*=UTF-8''${utf8Name}`,
    });
    res.send(buffer);
  }

  @Get(':id/timeline')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ไทม์ไลน์การดำเนินการ' })
  getTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTimeline(id);
  }

  @Get(':id/attachments')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: 'ไฟล์แนบของสารบรรณ' })
  getAttachments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.getAttachments(id, user);
  }

  @Post()
  @RequirePermissions({ module: 'correspondence', action: 'create', subject: 'Ticket' })
  @ApiOperation({ summary: 'สร้างสารบรรณใหม่ + มอบหมายกอง' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions({ module: 'correspondence', action: 'update', subject: 'Ticket' })
  @ApiOperation({ summary: 'แก้ไขข้อมูลหนังสือ (ไม่แตะเลขทะเบียน/สถานะ/ลายเซ็น)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  // ═══════════════ v4 workflow (rework/saraban-v4) ═══════════════
  @Post('v4')
  @RequirePermissions({ module: 'correspondence', action: 'create', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] สร้างสารบรรณ + มอบหมายผู้ปฏิบัติ (หัวหน้ากอง)' })
  createV4(@Body() dto: CreateTicketV4Dto, @CurrentUser() user: any) {
    return this.service.createV4(dto, user);
  }

  @Post(':id/v4/action')
  // service ตรวจ step + สิทธิ์คนทำเอง (ปลัด/นายกมี read แต่อาจไม่มี update)
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] ดำเนินการ 1 step (เลือกกอง/เซ็น/ลงเลขกอง/ส่งต่อ)' })
  actionV4(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketActionV4Dto, @CurrentUser() user: any) {
    return this.service.actionV4(id, dto, user);
  }

  @Post(':id/v4/return')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] ตีกลับไปผู้ส่งก่อนหน้า / คนสร้าง' })
  returnV4(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnV4Dto, @CurrentUser() user: any) {
    return this.service.returnV4(id, dto, user);
  }

  @Patch(':id/v4')
  @RequirePermissions({ module: 'correspondence', action: 'update', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] ขอแก้ไขเอกสาร (คนสร้าง จนกว่านายกปิด)' })
  editV4(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketV4Dto, @CurrentUser() user: any) {
    return this.service.editV4(id, dto, user);
  }

  @Patch(':id/v4/overlay')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @ApiOperation({ summary: '[v4] บันทึกตำแหน่ง overlay (ตรา+ลายเซ็น) บน PDF' })
  saveOverlay(@Param('id', ParseUUIDPipe) id: string, @Body('layout') layout: any, @CurrentUser() user: any) {
    return this.service.saveOverlayV4(id, layout, user);
  }

  @Delete(':id')
  @RequirePermissions({ module: 'correspondence', action: 'delete', subject: 'Ticket' })
  @ApiOperation({ summary: 'ลบสารบรรณ (ผู้สร้างหรือผู้ดูแลระบบ)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
