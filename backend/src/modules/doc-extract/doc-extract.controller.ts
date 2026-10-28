import { Controller, Post, UseGuards, UseInterceptors, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DocExtractService } from './doc-extract.service';

/**
 * AI อ่านหนังสือแล้วกรอกฟอร์มสร้างสารบรรณให้ — path ขึ้นต้น correspondence
 * จึงถูกปิดตามโมดูลสารบรรณของ อบต. อัตโนมัติ (module-access.interceptor)
 */
@ApiTags('correspondence-ai')
@ApiBearerAuth('access-token')
@Controller('correspondence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocExtractController {
  constructor(private readonly service: DocExtractService) {}

  @Post('ai-extract')
  @ApiOperation({ summary: 'ให้ AI อ่านไฟล์หนังสือ (PDF/รูป) แล้วคืนข้อมูลสำหรับกรอกฟอร์มสร้างสารบรรณ — ไม่เก็บไฟล์' })
  @RequirePermissions({ module: 'correspondence', action: 'create', subject: 'Ticket' })
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  }))
  async extract(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('กรุณาแนบไฟล์หนังสือ');
    const total = files.reduce((n, f) => n + f.size, 0);
    // คำขอไป Claude จำกัด 32MB (base64 ขยาย ~1.33 เท่า) — กันไว้ที่ 22MB ไฟล์ดิบ
    if (total > 22 * 1024 * 1024) throw new BadRequestException('ไฟล์รวมใหญ่เกินไปสำหรับระบบอ่านเอกสาร (สูงสุด ~22MB) — กรุณากรอกเอง');
    return this.service.extract(files);
  }
}
