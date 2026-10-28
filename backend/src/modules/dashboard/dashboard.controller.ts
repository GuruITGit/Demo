import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'ภาพรวมระบบ' })
  getSummary(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getSummary(orgId, userId, roles);
  }

  @Get('mayor')
  @ApiOperation({ summary: 'Dashboard นายก' })
  getMayorDashboard(@CurrentUser('organizationId') orgId: string) {
    return this.service.getMayorDashboard(orgId);
  }

  @Get('clerk')
  @ApiOperation({ summary: 'Dashboard ปลัด' })
  getClerkDashboard(@CurrentUser('organizationId') orgId: string) {
    return this.service.getClerkDashboard(orgId);
  }

  @Get('officer')
  @ApiOperation({ summary: 'Dashboard เจ้าหน้าที่' })
  getOfficerDashboard(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.getOfficerDashboard(orgId, userId);
  }

  @Get('charts')
  @ApiOperation({ summary: 'ข้อมูลกราฟ Dashboard' })
  getChartData(@CurrentUser('organizationId') orgId: string) {
    return this.service.getChartData(orgId);
  }
}
