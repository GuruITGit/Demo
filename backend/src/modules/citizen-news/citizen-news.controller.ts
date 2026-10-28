import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CitizenNewsService } from './citizen-news.service';

/** ข่าว/ประกาศ สำหรับประชาชน (สาธารณะ ไม่มี JWT) — แสดงเฉพาะที่เผยแพร่แล้ว */
@ApiTags('citizen-news')
@Controller('citizen/news')
export class CitizenNewsController {
  constructor(private readonly service: CitizenNewsService) {}

  @Get()
  @ApiOperation({ summary: 'รายการข่าว/ประกาศที่เผยแพร่' })
  list(@Query('org') org?: string, @Query('category') category?: string, @Query('limit') limit?: string) {
    return this.service.listPublic(org, category, limit ? Number(limit) : 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'รายละเอียดข่าว' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Query('org') org?: string) {
    return this.service.detailPublic(id, org);
  }
}
