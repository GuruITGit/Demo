import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';

@ApiTags('leave')
@ApiBearerAuth('access-token')
@Controller('leave')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('requests')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'รายการคำขอลา' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Query() dto: LeaveQueryDto,
  ) { return this.service.findAll(orgId, dto, userId, roles); }

  @Get('requests/my')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'คำขอลาของฉัน' })
  findMy(@CurrentUser('id') userId: string, @Query() dto: PaginationDto) {
    return this.service.findMyRequests(userId, dto);
  }

  @Get('types')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ประเภทการลา' })
  getTypes(@CurrentUser('organizationId') orgId: string) {
    return this.service.getLeaveTypes(orgId);
  }

  @Get('quotas/my')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'โควต้าวันลาของฉัน' })
  getMyQuotas(@CurrentUser('id') userId: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.getMyQuotas(userId, orgId);
  }

  @Get('requests/:id')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'รายละเอียดคำขอลา' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findOne(id, orgId);
  }

  @Post('requests')
  @RequirePermissions({ module: 'leave', action: 'create', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ยื่นคำขอลา' })
  create(@Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.createRequest(dto, orgId, userId);
  }

  @Post('requests/:id/submit')
  @RequirePermissions({ module: 'leave', action: 'create', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ส่งคำขอลา' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.submit(id, orgId, userId);
  }

  @Post('requests/:id/approve')
  @RequirePermissions({ module: 'leave', action: 'approve', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'อนุมัติ' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string, @Body('comment') comment?: string) {
    return this.service.approve(id, orgId, userId, comment);
  }

  @Post('requests/:id/reject')
  @RequirePermissions({ module: 'leave', action: 'approve', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ไม่อนุมัติ' })
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string, @Body('comment') comment: string) {
    return this.service.reject(id, orgId, userId, comment);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions({ module: 'leave', action: 'create', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ยกเลิก' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.cancel(id, orgId, userId);
  }

  @Delete('requests/:id')
  @RequirePermissions({ module: 'leave', action: 'read', subject: 'LeaveRequest' })
  @ApiOperation({ summary: 'ลบคำขอลา (เจ้าของหรือผู้ดูแลระบบ)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.remove(id, orgId, user);
  }
}
