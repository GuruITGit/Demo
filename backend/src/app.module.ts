import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { join } from 'path';
import configuration from './config/configuration';
import { ModuleAccessModule } from './common/modules/module-access.module';
import { ModuleAccessInterceptor } from './common/modules/module-access.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { CorrespondenceModule } from './modules/correspondence/correspondence.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HrModule } from './modules/hr/hr.module';
import { LeaveModule } from './modules/leave/leave.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorageModule } from './modules/storage/storage.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WaterModule } from './modules/water/water.module';
import { CitizenReportModule } from './modules/citizen-report/citizen-report.module';
import { DocExtractModule } from './modules/doc-extract/doc-extract.module';
import { PlatformSecretsModule } from './modules/platform-secrets/platform-secrets.module';
import { DocEditorModule } from './modules/doc-editor/doc-editor.module';
import { CitizenNewsModule } from './modules/citizen-news/citizen-news.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MarketModule } from './modules/market/market.module';
import { WasteModule } from './modules/waste/waste.module';
import { CitizenPayModule } from './modules/citizen-pay/citizen-pay.module';
import { SequenceModule } from './common/services/sequence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [join(__dirname, 'database', 'entities', '*.entity.{ts,js}')],
        migrations: [join(__dirname, 'database', 'migrations', '*.{ts,js}')],
        // รัน migration ที่ค้างอยู่อัตโนมัติตอนสตาร์ท (prod อัปเดต schema ให้เองตอน deploy)
        migrationsRun: true,
        synchronize: config.get('database.synchronize'),
        logging: config.get('database.logging'),
        ssl: config.get('database.ssl') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
      }),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('throttle.ttl'),
            limit: config.get('throttle.limit'),
          },
        ],
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        store: 'memory',
        ttl: 300,
        max: 1000,
      }),
    }),

    AuthModule,
    UsersModule,
    OrganizationsModule,
    RbacModule,
    CorrespondenceModule,
    TicketModule,
    SignaturesModule,
    DocumentsModule,
    NotificationsModule,
    HrModule,
    LeaveModule,
    MeetingsModule,
    AssetsModule,
    AuditModule,
    StorageModule,
    PdfModule,
    DashboardModule,
    GatewayModule,
    HealthModule,
    SettingsModule,
    WaterModule,
    CitizenReportModule,
    DocExtractModule,
    PlatformSecretsModule,
    DocEditorModule,
    CitizenNewsModule,
    MaintenanceModule,
    ProjectsModule,
    MarketModule,
    WasteModule,
    CitizenPayModule,
    SequenceModule,
    ModuleAccessModule,
  ],
  providers: [
    // เปิดใช้ rate limiting ทั่วทั้งแอป (เดิม ThrottlerModule ถูกตั้งค่าไว้แต่ไม่เคยถูกบังคับใช้
    // ทำให้ @Throttle บน login เป็น no-op) — ตอนนี้ทุก endpoint ถูกจำกัดตาม throttle config
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // บล็อก API ของโมดูลที่หน่วยงานปิดใช้งาน (feature flags ต่อ อบต.) — รันหลัง auth guard
    { provide: APP_INTERCEPTOR, useClass: ModuleAccessInterceptor },
  ],
})
export class AppModule {}
