import {
  Controller, Get, Post, Delete, Param, Res,
  UseGuards, UploadedFile, UseInterceptors, Query, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Post('upload')
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'อัปโหลดไฟล์' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @Query('refType') refType?: string,
    @Query('refId') refId?: string,
    @Query('bucket') bucket?: string,
    @Query('caption') caption?: string,
    @Query('category') category?: string,
  ) {
    return this.service.uploadFile(file, bucket || 'documents', userId, refType, refId, caption, category);
  }

  @Get('files')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'รายการไฟล์แนบของรายการหนึ่ง' })
  listByRef(
    @Query('refType') refType: string,
    @Query('refId') refId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getFilesByRef(refType, refId, user);
  }

  // route สาธารณะ (เพราะ <img>/iframe ส่ง Authorization header ไม่ได้) — แต่ไฟล์ใน private bucket
  // ต้องแนบ signed token (ออกโดย /storage/files ให้เฉพาะผู้ใช้ที่ผ่าน auth) จึงจะดาวน์โหลดได้
  @Get('files/:bucket/*')
  @Public()
  @ApiOperation({ summary: 'ดาวน์โหลดไฟล์' })
  async getFile(
    @Param('bucket') bucket: string,
    @Param('0') objectKey: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    this.service.assertBucket(bucket);
    if (this.service.isBucketPrivate(bucket) && !this.service.verifyFileToken(bucket, objectKey, exp, sig)) {
      throw new NotFoundException('ไม่พบไฟล์');
    }
    // ถ้าใช้ Supabase → redirect ไป public URL โดยตรง
    const publicUrl = await this.service.getPublicUrl(bucket, objectKey);
    if (publicUrl) {
      return res.redirect(302, publicUrl);
    }
    // MinIO / filesystem (local dev) → stream ไฟล์ พร้อม Content-Type ให้เบราว์เซอร์ preview ได้
    const ext = (objectKey.split('.').pop() || '').toLowerCase();
    const CT: Record<string, string> = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip',
    };
    // เฉพาะชนิดที่พรีวิวได้อย่างปลอดภัยเท่านั้นที่ให้ inline — ชนิดอื่น (รวม .svg/.html ที่ไม่รู้จัก)
    // บังคับดาวน์โหลด กัน stored XSS จากไฟล์ที่อัปโหลดแล้ว render เป็น HTML/สคริปต์ใน origin เดียวกัน
    const INLINE_SAFE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
    if (CT[ext]) res.setHeader('Content-Type', CT[ext]);
    if (INLINE_SAFE.has(ext)) {
      res.setHeader('Content-Disposition', 'inline');
      // อนุญาตให้ frontend (คนละ origin ตอน local dev) ฝังไฟล์ที่ปลอดภัยใน iframe/img เพื่อ preview
      // (prod ใช้ Supabase redirect จึงไม่ผ่าน route นี้)
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    } else {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    const stream = await this.service.getFileStream(bucket, objectKey);
    (stream as any).pipe(res);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'ลบไฟล์' })
  deleteFile(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deleteFile(id, userId);
  }
}
