import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** แหล่งข้อมูลสำหรับ seed ค่าเริ่มต้นของลำดับ (ครั้งแรกที่สร้างแถว) — literal เท่านั้น ห้ามรับจากผู้ใช้ */
export interface SequenceSource {
  /** ชื่อตารางที่เก็บเลขเดิม (literal) */
  table: string;
  /** คอลัมน์เลขที่มีตัวเลขต่อท้าย เช่น complaint_number (literal) */
  column: string;
  /** ถ้าเลขรีเซ็ตรายปีงบ ให้ส่งปีงบ — จะแยกลำดับต่อปี และ seed เฉพาะปีนั้น */
  fiscalYear?: number;
}

/**
 * ออกเลขลำดับแบบ atomic กันเลขซ้ำ (race + ลบแล้วสร้างใหม่)
 * ใช้ตาราง document_number_sequences (unique org+doc_type+year) เป็นตัวนับที่เชื่อถือได้
 *
 * ครั้งแรกที่ยังไม่มีแถว จะ seed จาก "เลขสูงสุดที่เคยออก" (high-water) ของตารางต้นทาง
 * เพื่อไม่ให้ชนกับข้อมูลเดิม; หลังจากนั้นเป็น +1 อะตอมมิกล้วน ไม่พึ่ง count() อีก
 */
@Injectable()
export class SequenceService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async next(orgId: string, key: string, source: SequenceSource): Promise<number> {
    const { table, column, fiscalYear } = source;
    // table/column เป็น literal จาก call site เท่านั้น — กันพลาดด้วย whitelist รูปแบบชื่อ
    if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) {
      throw new Error(`SequenceService: invalid source ${table}.${column}`);
    }
    const rowYear = fiscalYear ?? 0;
    const params: any[] = [orgId, key, rowYear];
    let seedWhere = 'organization_id = $1';
    if (fiscalYear != null) {
      params.push(fiscalYear);
      seedWhere += ` AND fiscal_year = $4`;
    }
    // ดึงตัวเลขต่อท้ายของเลขเดิม (POSIX regex) แล้วหา MAX เป็นจุดเริ่ม (+1)
    const seedSql =
      `GREATEST((SELECT COALESCE(MAX(CAST(substring(${column} from '([0-9]+)$') AS INTEGER)), 0) ` +
      `FROM ${table} WHERE ${seedWhere}), 0) + 1`;
    const rows = await this.ds.query(
      `INSERT INTO document_number_sequences (organization_id, doc_type, year, current_number)
       VALUES ($1, $2, $3, ${seedSql})
       ON CONFLICT (organization_id, doc_type, year)
       DO UPDATE SET current_number = document_number_sequences.current_number + 1, updated_at = NOW()
       RETURNING current_number`,
      params,
    );
    return rows[0].current_number as number;
  }
}
