import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageService } from './storage.service';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { StorageController } from './storage.controller';
import { SettingsModule } from '../settings/settings.module';
import { AttachmentAccessRegistry } from './attachment-access.registry';

// ชนิดไฟล์ที่อนุญาต (กันอัปโหลดไฟล์อันตราย เช่น .exe/.html/.svg) — ตรวจฝั่ง server (ฝั่ง client กันได้แค่ผิวเผิน)
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|zip|txt|csv)$/i;
// เพดานแข็ง (กัน DoS) — ขนาดที่บังคับใช้จริงควบคุมด้วย setting file.max_size_mb (admin ปรับได้)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

@Module({
  imports: [
    SettingsModule,
    TypeOrmModule.forFeature([FileUpload]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE, files: 20 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_EXT.test(file.originalname)) cb(null, true);
        else cb(new BadRequestException('ชนิดไฟล์นี้ไม่รองรับ (อนุญาต: เอกสาร/รูปภาพ/zip เท่านั้น)'), false);
      },
    }),
  ],
  controllers: [StorageController],
  providers: [StorageService, AttachmentAccessRegistry],
  exports: [StorageService, AttachmentAccessRegistry],
})
export class StorageModule {}
