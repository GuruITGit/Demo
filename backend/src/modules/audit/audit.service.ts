import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>) {}

  async findAll(orgId: string, dto: PaginationDto & { action?: string; module?: string; userId?: string; dateFrom?: string; dateTo?: string }) {
    const qb = this.auditRepo.createQueryBuilder('a')
      .where('a.organization_id = :orgId', { orgId });

    if (dto.search) {
      qb.andWhere(
        '(a.user_name ILIKE :s OR a.resource_title ILIKE :s OR a.action ILIKE :s)',
        { s: `%${dto.search}%` },
      );
    }
    if (dto.action) qb.andWhere('a.action = :action', { action: dto.action });
    if (dto.module) qb.andWhere('a.module = :module', { module: dto.module });
    if (dto.userId) qb.andWhere('a.user_id = :userId', { userId: dto.userId });
    if (dto.dateFrom) qb.andWhere('a.acted_at >= :from', { from: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('a.acted_at <= :to', { to: dto.dateTo });

    qb.orderBy('a.acted_at', 'DESC').skip(dto.skip).take(dto.limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(await this.fillUserNames(data), total, dto);
  }

  /**
   * เติมชื่อผู้ดำเนินการให้แถวที่ไม่ได้บันทึก user_name ไว้ (โมดูลอื่นบันทึกแค่ user_id)
   * — ไม่งั้นหน้าประวัติกิจกรรมโชว์ UUID ดิบ
   * เลือกเฉพาะคอลัมน์ชื่อ (ห้าม select ทั้ง entity — password_hash จะหลุด)
   */
  private async fillUserNames(rows: AuditLog[]): Promise<AuditLog[]> {
    const missing = [...new Set(rows.filter((r) => !r.userName && r.userId).map((r) => r.userId))];
    if (missing.length === 0) return rows;
    const users: Array<{ id: string; full_name_th: string }> = await this.auditRepo.query(
      'SELECT id, full_name_th FROM users WHERE id = ANY($1)', [missing],
    );
    const nameById = new Map(users.map((u) => [u.id, u.full_name_th]));
    for (const r of rows) {
      if (!r.userName && r.userId) r.userName = nameById.get(r.userId) || r.userName;
    }
    return rows;
  }

  async getStats(orgId: string) {
    const byAction = await this.auditRepo
      .createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(a.id)', 'count')
      .where('a.organization_id = :orgId', { orgId })
      .groupBy('a.action')
      .getRawMany();

    const byModule = await this.auditRepo
      .createQueryBuilder('a')
      .select('a.module', 'module')
      .addSelect('COUNT(a.id)', 'count')
      .where('a.organization_id = :orgId', { orgId })
      .groupBy('a.module')
      .getRawMany();

    return { byAction, byModule };
  }
}
