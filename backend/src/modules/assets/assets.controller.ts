import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AssetQueryDto } from './dto/asset-query.dto';
import { CreateAssetDto, UpdateAssetDto, TransferAssetDto, InspectAssetDto } from './dto/asset.dto';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() dto: AssetQueryDto) {
    return this.service.findAll(orgId, dto);
  }

  @Get('categories')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  getCategories(@CurrentUser('organizationId') orgId: string) {
    return this.service.getCategories(orgId);
  }

  @Get(':id')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findOne(id, orgId);
  }

  @Post()
  @RequirePermissions({ module: 'assets', action: 'create', subject: 'Asset' })
  create(@Body() dto: CreateAssetDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.create(dto, orgId, userId);
  }

  @Put(':id')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.update(id, dto, orgId, user);
  }

  @Delete(':id')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.remove(id, orgId, user);
  }

  @Post('scan')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  scan(@Body('qrCode') qrCode: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.scanQR(qrCode, orgId);
  }

  @Post(':id/transfer')
  @RequirePermissions({ module: 'assets', action: 'transfer', subject: 'Asset' })
  transfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferAssetDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.transfer(id, dto, orgId, userId);
  }

  @Get(':id/transfers')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  getTransfers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTransfers(id);
  }

  @Post(':id/inspect')
  @RequirePermissions({ module: 'assets', action: 'inspect', subject: 'Asset' })
  addInspection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InspectAssetDto, @CurrentUser('id') userId: string) {
    return this.service.addInspection(id, dto, userId);
  }

  @Get(':id/inspections')
  @RequirePermissions({ module: 'assets', action: 'read', subject: 'Asset' })
  getInspections(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getInspections(id);
  }
}
