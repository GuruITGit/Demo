import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CorrespondenceService } from './correspondence.service';
import {
  CreateIncomingDocDto, AssignDocDto, ActionNoteDto,
  CreateOutgoingDocDto, CorrespondenceQueryDto,
} from './dto/correspondence.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('correspondence')
@ApiBearerAuth('access-token')
@Controller('correspondence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CorrespondenceController {
  constructor(private readonly service: CorrespondenceService) {}

  @Get('incoming')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'รายการหนังสือเข้า' })
  findAllIncoming(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Query() dto: CorrespondenceQueryDto,
  ) { return this.service.findAllIncoming(orgId, dto, userId); }

  @Get('incoming/stats')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'สถิติหนังสือเข้า' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.service.getStats(orgId);
  }

  @Get('incoming/:id')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'รายละเอียดหนังสือเข้า' })
  findOneIncoming(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
  ) { return this.service.findOneIncoming(id, orgId); }

  @Post('incoming')
  @RequirePermissions({ module: 'correspondence', action: 'create', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'รับหนังสือเข้าใหม่' })
  createIncoming(
    @Body() dto: CreateIncomingDocDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.createIncoming(dto, orgId, userId); }

  @Post('incoming/:id/assign')
  @RequirePermissions({ module: 'correspondence', action: 'assign', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'มอบหมายงาน' })
  assignIncoming(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDocDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.assignIncoming(id, dto, orgId, userId); }

  @Post('incoming/:id/action')
  @RequirePermissions({ module: 'correspondence', action: 'update', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'สั่งการ' })
  addActionNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionNoteDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.addActionNote(id, dto, orgId, userId); }

  @Post('incoming/:id/close')
  @RequirePermissions({ module: 'correspondence', action: 'update', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'ปิดงาน' })
  closeIncoming(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body('note') note?: string,
  ) { return this.service.closeIncoming(id, orgId, userId, note); }

  @Get('incoming/:id/workflow')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'ประวัติ Workflow' })
  getWorkflow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getWorkflowHistory(id, 'INCOMING');
  }

  @Delete('incoming/:id')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'IncomingDocument' })
  @ApiOperation({ summary: 'ลบหนังสือเข้า (เจ้าของหรือผู้ดูแลระบบ)' })
  removeIncoming(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() user: any,
  ) { return this.service.removeIncoming(id, orgId, user); }

  @Get('outgoing')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'รายการหนังสือส่ง' })
  findAllOutgoing(
    @CurrentUser('organizationId') orgId: string,
    @Query() dto: CorrespondenceQueryDto,
  ) { return this.service.findAllOutgoing(orgId, dto); }

  @Get('outgoing/:id')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'รายละเอียดหนังสือส่ง' })
  findOneOutgoing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
  ) { return this.service.findOneOutgoing(id, orgId); }

  @Post('outgoing')
  @RequirePermissions({ module: 'correspondence', action: 'create', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'สร้างหนังสือส่ง' })
  createOutgoing(
    @Body() dto: CreateOutgoingDocDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.createOutgoing(dto, orgId, userId); }

  @Post('outgoing/:id/send')
  @RequirePermissions({ module: 'correspondence', action: 'sign', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'ส่งหนังสือ' })
  sendOutgoing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.sendOutgoing(id, orgId, userId); }

  @Get('outgoing/:id/workflow')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'ประวัติหนังสือส่ง' })
  getOutgoingWorkflow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getWorkflowHistory(id, 'OUTGOING');
  }

  @Delete('outgoing/:id')
  @RequirePermissions({ module: 'correspondence', action: 'read', subject: 'OutgoingDocument' })
  @ApiOperation({ summary: 'ลบหนังสือส่ง (เจ้าของหรือผู้ดูแลระบบ)' })
  removeOutgoing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() user: any,
  ) { return this.service.removeOutgoing(id, orgId, user); }
}
