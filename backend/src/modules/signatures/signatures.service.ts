import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { UserSignature } from '../../database/entities/user-signature.entity';
import { SignatureLog } from '../../database/entities/signature-log.entity';
import { StorageService } from '../storage/storage.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { sha256 } from '../../common/utils/hash.util';

@Injectable()
export class SignaturesService {
  constructor(
    @InjectRepository(UserSignature) private sigRepo: Repository<UserSignature>,
    @InjectRepository(SignatureLog) private logRepo: Repository<SignatureLog>,
    private storageService: StorageService,
  ) {}

  async getMySignatures(userId: string) {
    return this.sigRepo.createQueryBuilder('sig')
      .addSelect('sig.imageData')
      .where('sig.userId = :userId AND sig.isActive = :active', { userId, active: true })
      .orderBy('sig.createdAt', 'DESC')
      .getMany();
  }

  async createSignature(userId: string, dto: any, file?: Express.Multer.File) {
    // ต้องมีรูปลายเซ็นอย่างใดอย่างหนึ่ง (ไฟล์อัปโหลด หรือ base64) — กันสร้างลายเซ็นเปล่า
    if (!file && !dto?.imageData) {
      throw new BadRequestException('กรุณาแนบรูปลายเซ็นหรือวาดลายเซ็น');
    }
    let imageUrl: string = null;
    if (file) {
      const uploaded = await this.storageService.uploadFile(file, 'signatures', userId);
      imageUrl = uploaded.url;
    } else if (dto.imageData) {
      imageUrl = null;
    }

    if (dto.isDefault) {
      await this.sigRepo.update({ userId }, { isDefault: false });
    }

    const saved = await this.sigRepo.save({
      userId,
      sigType: dto.sigType || 'drawn',
      imageUrl,
      imageData: dto.imageData,
      isDefault: dto.isDefault || false,
    });

    return this.sigRepo.createQueryBuilder('sig')
      .addSelect('sig.imageData')
      .where('sig.id = :id', { id: saved.id })
      .getOne();
  }

  async updateSignature(id: string, userId: string, dto: any) {
    const sig = await this.sigRepo.findOne({ where: { id, userId } });
    if (!sig) throw new NotFoundException('ไม่พบลายเซ็น');

    if (dto.isDefault) {
      await this.sigRepo.update({ userId }, { isDefault: false });
    }

    Object.assign(sig, dto);
    return this.sigRepo.save(sig);
  }

  async deleteSignature(id: string, userId: string) {
    const sig = await this.sigRepo.findOne({ where: { id, userId } });
    if (!sig) throw new NotFoundException('ไม่พบลายเซ็น');
    if (sig.isDefault) throw new BadRequestException('ไม่สามารถลบลายเซ็นหลักได้');
    await this.sigRepo.update(id, { isActive: false });
    return { message: 'ลบลายเซ็นสำเร็จ' };
  }

  async signDocument(
    userId: string,
    signatureId: string,
    documentType: string,
    documentId: string,
    documentTitle: string,
    ip: string,
    userAgent: string,
    documentHash?: string,
    position?: any,
  ) {
    const sig = await this.sigRepo.findOne({ where: { id: signatureId, userId, isActive: true } });
    if (!sig) throw new NotFoundException('ไม่พบลายเซ็น');

    const log = await this.logRepo.save({
      userId,
      signatureId,
      documentType,
      documentId,
      documentTitle,
      ipAddress: ip,
      userAgent,
      browser: this.extractBrowser(userAgent),
      deviceType: this.extractDeviceType(userAgent),
      documentHash: documentHash || sha256(`${documentType}:${documentId}`),
      ...position,
    });

    return log;
  }

  async getSignatureStats(userId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [total, thisMonth] = await Promise.all([
      this.logRepo.count({ where: { userId } }),
      this.logRepo.count({ where: { userId, signedAt: MoreThanOrEqual(monthStart) } }),
    ]);
    return { total, เดือนนี้: thisMonth };
  }

  async getSignatureLogs(userId: string, dto: PaginationDto) {
    const [data, total] = await this.logRepo.findAndCount({
      where: { userId },
      order: { signedAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });
    return paginate(data, total, dto);
  }

  async getDocumentSignatureLogs(documentType: string, documentId: string) {
    return this.logRepo.find({
      where: { documentType, documentId },
      relations: ['user'],
      order: { signedAt: 'ASC' },
    });
  }

  private extractBrowser(ua: string): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private extractDeviceType(ua: string): string {
    if (!ua) return 'desktop';
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
  }
}
