import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformSecretsService, AiProvider } from './platform-secrets.service';

class UpdateAiSettingsDto {
  @IsOptional() @IsIn(['anthropic', 'gemini', '']) provider?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
  @IsOptional() @IsString() @MaxLength(100) geminiModel?: string;
  /** '' = ลบ (กลับไปใช้ .env) · ไม่ส่ง = ไม่เปลี่ยน */
  @IsOptional() @IsString() @MaxLength(400) anthropicKey?: string;
  @IsOptional() @IsString() @MaxLength(400) geminiKey?: string;
}

class TestAiDto {
  @IsIn(['anthropic', 'gemini']) provider: AiProvider;
}

/** ตั้งค่าระดับเจ้าของระบบ (ใช้ร่วมทุก อบต.) — SUPER_ADMIN เท่านั้น · ไม่ส่ง key กลับออกไปเด็ดขาด */
@ApiTags('hub-settings')
@ApiBearerAuth('access-token')
@Controller('hub/ai-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PlatformSecretsController {
  constructor(private readonly service: PlatformSecretsService) {}

  @Get()
  @ApiOperation({ summary: 'สถานะการตั้งค่า AI อ่านหนังสือ (ไม่มีค่า key — มีแค่ 4 ตัวท้าย)' })
  get() {
    return this.service.aiStatus();
  }

  @Put()
  @ApiOperation({ summary: 'ตั้งผู้ให้บริการ / รุ่น / API key ของ AI อ่านหนังสือ' })
  update(@Body() dto: UpdateAiSettingsDto, @CurrentUser() user: any) {
    return this.service.updateAi(dto, user);
  }

  @Post('test')
  @ApiOperation({ summary: 'ทดสอบว่า API key ใช้ได้ (ไม่เสียค่า token)' })
  test(@Body() dto: TestAiDto) {
    return this.service.testAi(dto.provider);
  }
}
