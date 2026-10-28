import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrganizationDto, UpdateOrganizationDto, CreateDepartmentDto, UpdateDepartmentDto, CreateDivisionDto, OnboardOrgDto, ResetAdminPasswordDto, SetModulesDto, ClearCitizenReportsDto } from './dto/organization.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Req } from '@nestjs/common';
import type { Request } from 'express';

@ApiTags('organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Public()
  @Get('by-host')
  @ApiOperation({ summary: 'แบรนด์ อบต. ตามโดเมนที่เปิด (public — ให้หน้า login/ประชาชนโชว์ชื่อ+โลโก้อัตโนมัติ)' })
  byHost(@Req() req: Request) {
    return this.service.publicByHost((req.headers['x-forwarded-host'] as string) || req.headers.host);
  }

  @Get()
  @ApiOperation({ summary: 'รายการหน่วยงาน (เห็นเฉพาะของตัวเอง · SUPER_ADMIN เห็นหมด)' })
  findAll(@CurrentUser('organizationId') orgId: string, @CurrentUser('roles') roles: string[]) {
    return this.service.findAll(orgId, roles?.includes('SUPER_ADMIN'));
  }

  @Get('hub')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'HUB จัดการทุก อบต. (รวมที่ปิดใช้งาน) + จำนวนข้อมูลแต่ละหน่วยงาน' })
  hub() { return this.service.hub(); }

  @Get('modules/catalog')
  @ApiOperation({ summary: 'รายการโมดูลที่เปิด-ปิดได้ทั้งหมด' })
  moduleCatalog() { return this.service.moduleCatalog(); }

  @Get('current/modules')
  @ApiOperation({ summary: 'โมดูลที่ปิดของหน่วยงานผู้ใช้ปัจจุบัน (ให้ frontend ซ่อนเมนู)' })
  currentModules(@CurrentUser('organizationId') orgId: string) { return this.service.currentModules(orgId); }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'สร้างหน่วยงาน' })
  create(@Body() dto: CreateOrganizationDto) { return this.service.create(dto); }

  @Post('onboard')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'เปิดใช้งาน อบต. ใหม่ (สร้างหน่วยงาน + ผู้ดูแลคนแรก + โดเมน ในคลิกเดียว)' })
  onboard(@Body() dto: OnboardOrgDto) { return this.service.onboard(dto); }

  @Get(':id')
  @ApiOperation({ summary: 'ข้อมูลหน่วยงาน (เฉพาะของตัวเอง · SUPER_ADMIN เข้าได้หมด)' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('roles') roles: string[]) {
    return this.service.findOne(id, orgId, roles?.includes('SUPER_ADMIN'));
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'แก้ไขหน่วยงาน' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'แก้ไขหน่วยงาน (partial)' })
  patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/users')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ผู้ใช้ในหน่วยงาน (สำหรับเลือกคนที่จะรีเซ็ตรหัส)' })
  usersOf(@Param('id', ParseUUIDPipe) id: string) { return this.service.usersOf(id); }

  @Post(':id/reset-admin')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'รีเซ็ตรหัสผ่านผู้ดูแล/ผู้ใช้ในหน่วยงาน' })
  resetAdmin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetAdminPasswordDto) {
    return this.service.resetAdminPassword(id, dto);
  }

  @Post(':id/clear-citizen-reports')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ล้างข้อมูลเรื่องแจ้ง/ร้องเรียนทั้งหมดของหน่วยงาน (ก่อนเปิดใช้จริง) — ต้องพิมพ์รหัสหน่วยงานยืนยัน' })
  clearCitizenReports(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClearCitizenReportsDto) {
    return this.service.clearCitizenReports(id, dto.confirm);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ลบหน่วยงาน (เฉพาะเจ้าที่ไม่มีข้อมูลใช้งาน — มีข้อมูลให้ปิดใช้งานแทน)' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.removeOrg(id); }

  @Get(':id/modules')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'โมดูลที่เปิด/ปิดของหน่วยงาน + รายการโมดูลทั้งหมด' })
  modulesOf(@Param('id', ParseUUIDPipe) id: string) { return this.service.modulesOf(id); }

  @Put(':id/modules')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ตั้งค่าโมดูลที่ปิดของหน่วยงาน' })
  setModules(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetModulesDto) {
    return this.service.setModules(id, dto.disabledModules);
  }

  @Get(':id/departments')
  @ApiOperation({ summary: 'รายการกอง' })
  getDepts(@Param('id', ParseUUIDPipe) id: string, @Query('includeHidden') includeHidden?: string) {
    return this.service.getDepartments(id, includeHidden === '1' || includeHidden === 'true');
  }

  @Post(':id/departments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สร้างกอง' })
  createDept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDepartmentDto) {
    return this.service.createDepartment(id, dto);
  }

  @Put('departments/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'แก้ไขกอง' })
  updateDept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ลบกอง' })
  deleteDept(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteDepartment(id);
  }

  @Get('departments/:id/divisions')
  @ApiOperation({ summary: 'รายการฝ่าย' })
  getDivisions(@Param('id', ParseUUIDPipe) id: string) { return this.service.getDivisions(id); }

  @Post('departments/:id/divisions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สร้างฝ่าย' })
  createDivision(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDivisionDto) {
    return this.service.createDivision(id, dto);
  }
}
