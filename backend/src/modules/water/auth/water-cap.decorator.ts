import { SetMetadata } from '@nestjs/common';
import { WaterCap } from '../../../database/entities/water-user.entity';

export const WATER_CAP_KEY = 'water_cap';
/** ต้องมี capability อย่างน้อยหนึ่งใน caps ที่ระบุ (admin เข้าได้หมด) */
export const RequireWaterCap = (...caps: WaterCap[]) => SetMetadata(WATER_CAP_KEY, caps);
