import { Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { WaterUser } from '../../database/entities/water-user.entity';
import { WaterAuthController } from './auth/water-auth.controller';
import { WaterAuthService } from './auth/water-auth.service';
import { WaterUsersController } from './auth/water-users.controller';
import { WaterUsersService } from './auth/water-users.service';
import { WaterAuthGuard, WaterCapGuard } from './auth/water-auth.guard';
import { WaterController } from './water.controller';
import { WaterService } from './water.service';
import { WaterBillingController } from './water-billing.controller';
import { WaterMemberController } from './water-member.controller';
import { WaterBillingService } from './water-billing.service';
import { WaterReportController } from './water-report.controller';
import { WaterReportService } from './water-report.service';
import { WaterMasterController } from './water-master.controller';
import { WaterMasterService } from './water-master.service';
import { WaterCustomer } from '../../database/entities/water-customer.entity';
import { WaterNotice } from '../../database/entities/water-notice.entity';
import { WaterCollectionSummary } from '../../database/entities/water-collection.entity';
import { WaterApplication } from '../../database/entities/water-application.entity';
import { WaterMaster } from '../../database/entities/water-master.entity';
import { WaterBill } from '../../database/entities/water-bill.entity';
import { WaterRate } from '../../database/entities/water-rate.entity';
import { WaterLegacySyncController } from './legacy/legacy-sync.controller';
import { WaterLegacySyncService } from './legacy/legacy-sync.service';
import { WaterRemittance } from '../../database/entities/water-remittance.entity';
import { Organization } from '../../database/entities/organization.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaterCustomer, WaterNotice, WaterCollectionSummary, WaterApplication, WaterMaster, WaterBill, WaterRate, WaterRemittance, WaterUser, Organization, AuditLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
    PdfModule,
    StorageModule,
    // ไฟล์ทะเบียนอ่านจากหน่วยความจำแล้วทิ้ง ไม่เก็บลงดิสก์/storage
    // (เป็นรายชื่อชาวบ้านทั้งตำบล — เก็บไว้เท่าที่ต้องใช้ตอนนำเข้าเท่านั้น)
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (/\.(csv|json|txt)$/i.test(file.originalname)) cb(null, true);
        else cb(new BadRequestException('รองรับเฉพาะไฟล์ .csv และ .json (ถ้าเป็น Excel ให้ Save As → CSV ก่อน)'), false);
      },
    }),
  ],
  controllers: [WaterController, WaterBillingController, WaterMemberController, WaterReportController, WaterMasterController, WaterAuthController, WaterUsersController, WaterLegacySyncController],
  providers: [WaterService, WaterBillingService, WaterReportService, WaterMasterService, WaterAuthService, WaterUsersService, WaterLegacySyncService, WaterAuthGuard, WaterCapGuard],
  exports: [WaterService, WaterBillingService],
})
export class WaterModule {}
