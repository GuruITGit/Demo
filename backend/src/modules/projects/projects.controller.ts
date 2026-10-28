import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermissions({ module: 'projects', action: 'read', subject: 'Project' })
  @ApiOperation({ summary: 'รายการโครงการ' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() dto: ProjectQueryDto) {
    return this.service.findAll(orgId, dto as any);
  }

  @Get('stats')
  @RequirePermissions({ module: 'projects', action: 'read', subject: 'Project' })
  @ApiOperation({ summary: 'สถิติโครงการ' })
  getStats(@CurrentUser('organizationId') orgId: string, @Query('fiscalYear') fiscalYear?: number) {
    return this.service.getStats(orgId, fiscalYear);
  }

  @Get(':id')
  @RequirePermissions({ module: 'projects', action: 'read', subject: 'Project' })
  @ApiOperation({ summary: 'รายละเอียดโครงการ' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findOne(id, orgId);
  }

  @Get(':id/plans')
  @RequirePermissions({ module: 'projects', action: 'read', subject: 'Project' })
  @ApiOperation({ summary: 'ประวัติแผนของโครงการ' })
  getPlans(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPlans(id);
  }

  @Post()
  @RequirePermissions({ module: 'projects', action: 'manage', subject: 'Project' })
  @ApiOperation({ summary: 'สร้างโครงการ (เฉพาะผู้ดูแลระบบ)' })
  create(@Body() dto: CreateProjectDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.create(dto, orgId, user);
  }

  @Put(':id')
  @RequirePermissions({ module: 'projects', action: 'manage', subject: 'Project' })
  @ApiOperation({ summary: 'แก้ไขโครงการ (เฉพาะผู้ดูแลระบบ กรณีกรอกผิด)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.update(id, dto, orgId, user);
  }

  @Delete(':id')
  @RequirePermissions({ module: 'projects', action: 'manage', subject: 'Project' })
  @ApiOperation({ summary: 'ลบโครงการ (เฉพาะผู้ดูแลระบบ)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.remove(id, orgId, user);
  }

  @Post(':id/update')
  @RequirePermissions({ module: 'projects', action: 'manage', subject: 'Project' })
  @ApiOperation({ summary: 'อัปเดตความคืบหน้า (เพิ่ม revision ในแผนเดิม)' })
  addUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.addUpdate(id, dto, orgId, user);
  }

  @Post(':id/new-plan')
  @RequirePermissions({ module: 'projects', action: 'manage', subject: 'Project' })
  @ApiOperation({ summary: 'เปลี่ยนแผนใหม่ (แผนที่ N+1)' })
  addNewPlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.addNewPlan(id, dto, orgId, user);
  }
}
