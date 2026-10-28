import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, ChangePasswordDto, UserQueryDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'รายการผู้ใช้' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() dto: UserQueryDto) {
    return this.usersService.findAll(orgId, dto);
  }

  @Get('selectable')
  @ApiOperation({ summary: 'รายชื่อผู้ใช้สำหรับเลือก (ทุกคนที่ล็อกอิน)' })
  findSelectable(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.findSelectable(orgId);
  }

  @Get('tree')
  @ApiOperation({ summary: 'โครงสร้างองค์กรแบบ Tree (ฝ่าย/กอง/งาน/บุคลากร) สำหรับ People Picker' })
  findOrgTree(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.findOrgTree(orgId);
  }

  @Get('directory')
  @ApiOperation({ summary: 'ไดเรกทอรีบุคลากรแบบโฟลเดอร์ + สถานะวันนี้ (มา/ลา/ประชุม)' })
  findDirectory(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.findDirectory(orgId);
  }

  @Get('away/today')
  @ApiOperation({ summary: 'ปฏิทินบุคลากร — ใครลา/ประชุมวันนี้ + การลาที่จะมาถึง' })
  staffAway(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.staffAway(orgId);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'โปรไฟล์บุคลากร (ทุกคนดูได้ — ไม่รวมข้อมูลส่วนตัว)' })
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.getPublicProfile(id, orgId);
  }

  @Get('roles/list')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'รายการบทบาท' })
  listRoles() {
    return this.usersService.listRoles();
  }

  @Post('roles')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สร้างบทบาทใหม่' })
  createRole(@Body() dto: { nameTh: string; description?: string; level?: number }, @CurrentUser('organizationId') orgId: string) {
    return this.usersService.createRole(dto, orgId);
  }

  @Put('roles/:roleId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'แก้ไขชื่อ/รายละเอียดบทบาท' })
  updateRoleInfo(@Param('roleId', ParseUUIDPipe) roleId: string, @Body() dto: { nameTh?: string; description?: string; level?: number }) {
    return this.usersService.updateRoleInfo(roleId, dto);
  }

  @Delete('roles/:roleId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ลบบทบาท' })
  deleteRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.usersService.deleteRole(roleId);
  }

  @Get('permissions/list')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'รายการสิทธิ์ทั้งหมด' })
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Get('roles/:roleId/permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สิทธิ์ปัจจุบันของบทบาท' })
  getRolePermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.usersService.getRolePermissions(roleId);
  }

  @Put('roles/:roleId/permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ตั้งสิทธิ์ของบทบาท (admin)' })
  setRolePermissions(@Param('roleId', ParseUUIDPipe) roleId: string, @Body('permissionIds') permissionIds: string[], @CurrentUser() user: any) {
    return this.usersService.setRolePermissions(roleId, permissionIds, user.roles || []);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ข้อมูลผู้ใช้' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.findOne(id, orgId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สร้างผู้ใช้ใหม่' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.create(dto, orgId, userId);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'แก้ไขผู้ใช้' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.update(id, dto, orgId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ลบผู้ใช้' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.remove(id, orgId);
  }

  @Get(':id/roles')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'บทบาทของผู้ใช้' })
  getRoles(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserRoles(id);
  }

  @Post(':id/roles')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'กำหนดบทบาท' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.assignRole(id, dto.roleId, user.id, user.roles || []);
  }

  @Delete(':id/roles/:roleId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ถอดบทบาท' })
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.removeRole(id, roleId, user.roles || []);
  }

  @Put(':id/role')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ตั้งบทบาทเดียวให้ผู้ใช้ (แทนที่ของเดิม)' })
  setUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('roleId', ParseUUIDPipe) roleId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.setUserRole(id, roleId, user.id, user.roles || []);
  }

  @Post(':id/unlock')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'ปลดล็อกบัญชีที่ถูกระงับจากใส่รหัสผิด' })
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.unlockUser(id, orgId);
  }

  @Get(':id/permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สิทธิ์ของผู้ใช้ (direct only)' })
  getUserPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserPermissions(id);
  }

  @Get(':id/effective-permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'สิทธิ์จริงของผู้ใช้ (direct หรือ role)' })
  getEffectivePermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getEffectivePermissions(id);
  }

  @Put(':id/permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'กำหนดสิทธิ์ผู้ใช้ (bulk replace)' })
  setUserPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissionIds: string[] },
    @CurrentUser() user: any,
  ) {
    return this.usersService.setUserPermissions(id, body.permissionIds ?? [], user.id, user.roles || []);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'รีเซ็ต / เปลี่ยนรหัสผ่าน' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.resetPassword(id, orgId, dto.newPassword);
  }
}
