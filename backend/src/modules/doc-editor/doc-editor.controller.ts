import { BadRequestException, Controller, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocEditorService, DocPdfPayload } from './doc-editor.service';

/**
 * ตัวแต่งเอกสารสารบรรณ — path ขึ้นต้น correspondence จึงถูกปิดตามโมดูลสารบรรณของ อบต. อัตโนมัติ
 * payload ส่งเป็นไฟล์ JSON (multipart) เพราะ HTML + รูปลายเซ็นเกิน body limit 1MB ของ JSON ปกติ
 */
@ApiTags('correspondence-doc-editor')
@ApiBearerAuth('access-token')
@Controller('correspondence/tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocEditorController {
  constructor(private readonly service: DocEditorService) {}

  @Post(':id/doc-pdf')
  @ApiOperation({ summary: 'สร้าง PDF จากตัวแต่งเอกสาร (ชั้นที่แต่งซ้อนบนไฟล์แนบ/หน้าเปล่า) — attach=true เก็บเป็นไฟล์แนบของเรื่อง' })
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'Ticket' })
  @UseInterceptors(FileInterceptor('payload', { storage: memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } }))
  async docPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    let payload: DocPdfPayload;
    try { payload = JSON.parse(file?.buffer?.toString('utf8') || ''); } catch { throw new BadRequestException('ข้อมูลเอกสารไม่ถูกต้อง'); }
    const { buffer, filename, attachedId } = await this.service.renderTicketPdf(id, payload, user);
    const ascii = filename.replace(/[^\x20-\x7e]/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ...(attachedId ? { 'X-Attached-File-Id': attachedId, 'Access-Control-Expose-Headers': 'X-Attached-File-Id' } : {}),
    });
    res.end(buffer);
  }
}
