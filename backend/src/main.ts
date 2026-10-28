import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { StripServerFieldsInterceptor } from './common/interceptors/strip-server-fields.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const nodeEnv = configService.get<string>('nodeEnv');
  const frontendUrl = configService.get<string>('frontendUrl');

  // Fail fast: ห้ามรัน production ด้วย secret เริ่มต้น/ว่าง (กันการปลอม JWT)
  if (nodeEnv === 'production') {
    const isWeak = (v?: string) => !v || v.startsWith('dev-');
    if (
      isWeak(configService.get<string>('jwt.secret')) ||
      isWeak(configService.get<string>('jwt.refreshSecret'))
    ) {
      throw new Error(
        'FATAL: ต้องตั้งค่า JWT_SECRET และ JWT_REFRESH_SECRET ใน production (ห้ามใช้ค่าเริ่มต้น dev-*)',
      );
    }
  }

  // เชื่อ proxy ชั้นเดียวที่อยู่หน้าเรา (nginx) → req.ip = IP จริงของผู้ใช้ ไม่ใช่ IP ของ nginx/cloudflared
  // ไม่ตั้ง = rate limit ฝั่งประชาชน (@Throttle) นับรวมทุกคนเป็นคนเดียว และ audit log บันทึก IP ผิด
  // ใช้ 1 ไม่ใช่ true เพื่อไม่ให้ใครยัด X-Forwarded-For ปลอมเข้ามาแล้วเลี่ยง rate limit ได้
  app.set('trust proxy', 1);

  // JSON body 1mb (ค่าเริ่มต้น 100kb) — ตั้งค่าประปาส่งรูปลายเซ็น/โลโก้เป็น dataURL หลายรูปในคำขอเดียว
  app.useBodyParser('json', { limit: '1mb' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cookieParser());

  // ตัด '/' ท้าย URL ออก ไม่งั้น origin ของเบราว์เซอร์ (ไม่มี slash ท้าย) จะ match ไม่ติด → โดน CORS block
  const allowedOrigins = [frontendUrl, 'http://localhost:3000']
    .filter(Boolean)
    .map((o) => o!.replace(/\/+$/, ''));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token', 'X-Organization-Id'],
  });

  app.setGlobalPrefix('v1');
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new StripServerFieldsInterceptor(),
    new TransformInterceptor(),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SmartGov Office API')
      .setDescription('ระบบบริหารงานราชการอิเล็กทรอนิกส์ — REST API Documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'การยืนยันตัวตน')
      .addTag('users', 'ผู้ใช้งาน')
      .addTag('organizations', 'หน่วยงาน')
      .addTag('correspondence', 'สารบรรณ')
      .addTag('approvals', 'เสนอเซ็น')
      .addTag('signatures', 'ลายเซ็นดิจิทัล')
      .addTag('documents', 'คลังเอกสาร')
      .addTag('notifications', 'การแจ้งเตือน')
      .addTag('hr', 'บุคลากร')
      .addTag('leave', 'การลา')
      .addTag('meetings', 'การประชุม')
      .addTag('assets', 'ครุภัณฑ์')
      .addTag('complaints', 'เรื่องร้องเรียน')
      .addTag('audit', 'ประวัติกิจกรรม')
      .addTag('dashboard', 'แดชบอร์ด')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Seed/Reset ตอนสตาร์ท (ควบคุมด้วย env — ใช้ตั้งค่าครั้งเดียวบน prod)
  //   SEED_RESET=true  → ลบข้อมูลเก่าทั้งหมด + สร้างใหม่ (ตั้งครั้งเดียวแล้วลบออก)
  //   SEED_ON_START=true → seed แบบ idempotent (ไม่ลบของเดิม)
  if (process.env.SEED_RESET === 'true' || process.env.SEED_ON_START === 'true') {
    try {
      const { DataSource } = await import('typeorm');
      const ds = app.get(DataSource);
      const { seedRolesAndPermissions } = await import('./database/seeds/seed-roles-permissions');
      const { seedMasterData } = await import('./database/seeds/seed-master-data');
      const { seedInitialOrg } = await import('./database/seeds/seed-initial-org');
      const { seedDemoData } = await import('./database/seeds/seed-demo-data');
      if (process.env.SEED_RESET === 'true') {
        const { resetAllData } = await import('./database/seeds/reset-data');
        console.log('⚠️  SEED_RESET — ลบข้อมูลเก่าทั้งหมด...');
        await resetAllData(ds);
      }
      console.log('🌱 Seeding...');
      await seedRolesAndPermissions(ds);
      await seedMasterData(ds);
      await seedInitialOrg(ds);
      await seedDemoData(ds);
      console.log('✅ Seed เสร็จสิ้น');
    } catch (e) {
      console.error('Seed on start failed:', e);
    }
  }

  await app.listen(port);
  console.log(`🚀 SmartGov Backend running on: http://localhost:${port}/v1`);
  if (nodeEnv !== 'production') {
    console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  }
}

bootstrap();
