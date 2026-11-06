import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { cancelUnpaidTemporary } from './outside-temp';

const fakeDs = (found: { id: string; bill_id: string }[]) => {
  const calls: { sql: string; params: any[] }[] = [];
  const ds: any = { query: jest.fn(async (sql: string, params: any[]) => { calls.push({ sql, params }); return /^\s*SELECT/i.test(sql) ? found : []; }) };
  return { ds, calls };
};

describe('cancelUnpaidTemporary (แผงลอยชั่วคราวไม่จ่าย = สมัครไม่สำเร็จ)', () => {
  it('ไม่มีใบสมัครค้าง → คืน 0 และไม่ลบอะไร', async () => {
    const { ds, calls } = fakeDs([]);
    expect(await cancelUnpaidTemporary(ds, 'org1', { appCode: 'OUT-1' })).toBe(0);
    expect(calls).toHaveLength(1);
  });
  it('มีใบค้าง → ยกเลิกใบสมัครและลบบิลที่ยังไม่จ่ายของใบนั้นเท่านั้น', async () => {
    const { ds, calls } = fakeDs([{ id: 'a1', bill_id: 'b1' }, { id: 'a2', bill_id: 'b2' }]);
    expect(await cancelUnpaidTemporary(ds, 'org1', { staleMin: 30 })).toBe(2);
    expect(calls[0].sql).toContain("b.status = 'unpaid'"); // บิลที่แจ้งชำระแล้ว/ชำระแล้วไม่ถูกแตะ
    expect(calls[0].sql).toContain("tenancy_type = 'temporary'");
    expect(calls[0].params).toEqual(['org1', null, 30]);
    expect(calls[1].params).toEqual([['a1', 'a2']]);
    expect(calls[2].sql).toContain('DELETE FROM market_bills');
    expect(calls[2].params).toEqual([['b1', 'b2']]);
  });
});
