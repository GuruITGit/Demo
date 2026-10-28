import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'CLERK')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'รายการ Audit Logs' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() dto: AuditQueryDto) {
    return this.service.findAll(orgId, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'สถิติกิจกรรม' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.service.getStats(orgId);
  }
}
