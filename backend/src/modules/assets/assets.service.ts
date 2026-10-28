import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere, IsNull } from 'typeorm';
import { Asset } from '../../database/entities/asset.entity';
import { AssetCategory } from '../../database/entities/asset-category.entity';
import { AssetTransfer } from '../../database/entities/asset-transfer.entity';
import { AssetInspection } from '../../database/entities/asset-inspection.entity';
import * as QRCode from 'qrcode';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { assertCanModify } from '../../common/utils/ownership.util';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset) private assetRepo: Repository<Asset>,
    @InjectRepository(AssetCategory) private catRepo: Repository<AssetCategory>,
    @InjectRepository(AssetTransfer) private transferRepo: Repository<AssetTransfer>,
    @InjectRepository(AssetInspection) private inspectionRepo: Repository<AssetInspection>,
    private sequences: SequenceService,
  ) {}

  async findAll(orgId: string, dto: PaginationDto & { status?: string; deptId?: string; categoryId?: string }) {
    const base: FindOptionsWhere<Asset> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;
    if (dto.deptId) base.departmentId = dto.deptId;
    if (dto.categoryId) base.categoryId = dto.categoryId;

    const where: FindOptionsWhere<Asset>[] | FindOptionsWhere<Asset> = dto.search
      ? [
          { ...base, name: ILike(`%${dto.search}%`) },
          { ...base, assetCode: ILike(`%${dto.search}%`) },
        ]
      : base;

    const [data, total] = await this.assetRepo.findAndCount({
      where,
      relations: ['category', 'department'],
      skip: dto.skip,
      take: dto.limit,
      order: { assetCode: 'ASC' },
    });
    return paginate(data, total, dto);
  }

  async findOne(id: string, orgId: string) {
    const a = await this.assetRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['category', 'department', 'custodian'],
    });
    if (!a) throw new NotFoundException('ไม่พบครุภัณฑ์');
    return a;
  }

  async create(dto: any, orgId: string, userId: string) {
    const assetCode = dto.assetCode || `${orgId.slice(0, 4).toUpperCase()}-${String(
      await this.sequences.next(orgId, 'ASSET', { table: 'assets', column: 'asset_code' }),
    ).padStart(6, '0')}`;

    const qrData = JSON.stringify({ id: assetCode, org: orgId });

    return this.assetRepo.save({ ...dto, organizationId: orgId, createdBy: userId, assetCode, qrCode: qrData });
  }

  async update(id: string, dto: any, orgId: string, user: any) {
    const a = await this.findOne(id, orgId);
    assertCanModify(a, user, 'assets:update:Asset');
    Object.assign(a, dto);
    return this.assetRepo.save(a);
  }

  async remove(id: string, orgId: string, user: any) {
    const a = await this.findOne(id, orgId);
    assertCanModify(a, user, 'assets:delete:Asset');
    await this.assetRepo.softDelete(id);
    return { message: 'ลบครุภัณฑ์สำเร็จ' };
  }

  async scanQR(qrCode: string, orgId: string) {
    const data = JSON.parse(qrCode);
    return this.assetRepo.findOne({
      where: { assetCode: data.id, organizationId: orgId },
      relations: ['category', 'department', 'custodian'],
    });
  }

  async transfer(id: string, dto: any, orgId: string, userId: string) {
    const asset = await this.findOne(id, orgId);
    await this.assetRepo.update(id, { departmentId: dto.toDepartmentId, custodianId: dto.toCustodianId });

    return this.transferRepo.save({
      assetId: id,
      fromDepartmentId: asset.departmentId,
      toDepartmentId: dto.toDepartmentId,
      fromCustodianId: asset.custodianId,
      toCustodianId: dto.toCustodianId,
      transferDate: new Date(),
      reason: dto.reason,
      createdBy: userId,
    });
  }

  async getTransfers(assetId: string) {
    return this.transferRepo.find({
      where: { assetId },
      relations: ['fromDepartment', 'toDepartment', 'fromCustodian', 'toCustodian'],
      order: { createdAt: 'DESC' },
    });
  }

  async addInspection(assetId: string, dto: any, userId: string) {
    const { remarks, ...rest } = dto;
    const insp = await this.inspectionRepo.save({ ...rest, note: dto.note ?? remarks, assetId, inspectorId: userId });
    await this.assetRepo.update(assetId, { status: dto.condition === 'ชำรุด' ? 'ชำรุด' : 'ใช้งาน' });
    return insp;
  }

  async getInspections(assetId: string) {
    return this.inspectionRepo.find({
      where: { assetId },
      relations: ['inspector'],
      order: { inspectionDate: 'DESC' },
    });
  }

  async getCategories(orgId: string) {
    return this.catRepo.find({
      where: [{ organizationId: orgId, isActive: true }, { organizationId: IsNull(), isActive: true }],
    });
  }
}
