import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';
import { CreateEducationDto, CreateTrainingDto } from './dto/employee-sub.dto';

@ApiTags('hr')
@ApiBearerAuth('access-token')
@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrController {
  constructor(private readonly service: HrService) {}

  @Get('employees')
  @RequirePermissions({ module: 'hr', action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'รายการพนักงาน' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() dto: EmployeeQueryDto) {
    return this.service.findAllEmployees(orgId, dto);
  }

  @Get('positions')
  @RequirePermissions({ module: 'hr', action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'รายการตำแหน่ง' })
  getPositions(@CurrentUser('organizationId') orgId: string) {
    return this.service.getPositions(orgId);
  }

  @Get('employees/:id')
  @RequirePermissions({ module: 'hr', action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'ข้อมูลพนักงาน' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findOneEmployee(id, orgId);
  }

  @Post('employees')
  @RequirePermissions({ module: 'hr', action: 'create', subject: 'Employee' })
  @ApiOperation({ summary: 'เพิ่มพนักงาน' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.createEmployee(dto, orgId);
  }

  @Put('employees/:id')
  @RequirePermissions({ module: 'hr', action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'แก้ไขข้อมูลพนักงาน' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.updateEmployee(id, dto, orgId);
  }

  @Delete('employees/:id')
  @RequirePermissions({ module: 'hr', action: 'delete', subject: 'Employee' })
  @ApiOperation({ summary: 'ลบพนักงาน' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.removeEmployee(id, orgId);
  }

  @Get('employees/:id/education')
  @RequirePermissions({ module: 'hr', action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'ประวัติการศึกษา' })
  getEducation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEducation(id);
  }

  @Post('employees/:id/education')
  @RequirePermissions({ module: 'hr', action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'เพิ่มประวัติการศึกษา' })
  addEducation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateEducationDto) {
    return this.service.addEducation(id, dto);
  }

  @Get('employees/:id/training')
  @RequirePermissions({ module: 'hr', action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'ประวัติการอบรม' })
  getTraining(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTraining(id);
  }

  @Post('employees/:id/training')
  @RequirePermissions({ module: 'hr', action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'เพิ่มประวัติการอบรม' })
  addTraining(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTrainingDto) {
    return this.service.addTraining(id, dto);
  }
}
