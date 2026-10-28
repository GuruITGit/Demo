// ข้อมูลจำลองฝั่งเจ้าหน้าที่ — ชุดเดียวกับหน้าประชาชน (market/data.ts, waste/data.ts) เพื่อให้รหัสบิลตรงกัน
// ต้องซิงก์เมื่อแก้ข้อมูลในสองหน้านั้น (ตอนนี้เป็นเดโม่ ยังไม่มี backend)
type StallStatus = 'available' | 'reserved' | 'occupied';
interface StaffStall { id: string; row: string; status: StallStatus; tenantName?: string }
interface StaffData { bills: Bill[]; stalls: StaffStall[] }

const STAFF_TENANTS: Record<string, string> = {
  A01:'นางสาวศิริพร ทองดี', A02:'นายประเสริฐ ศรีสุข', A03:'นางอำไพ บุญรอด', A04:'นายธนพล วงศ์ษา', A05:'นายบุญมี คำไหล',
  A06:'นางสมใจ ใจดี', A08:'นางสาวกัญญา พิมพ์ดี', B02:'นายวิทยา แซ่ลี้', B04:'นางมะลิ แสงทอง', B05:'นางสาวนภัส ใจงาม',
  B07:'นายสมชาย ไทยเจริญ', C03:'นายวิชัย ผักสด', C06:'นางพัชรี ขำดี', C08:'นายอนันต์ ทองสุข', D01:'นางจันทร์เพ็ญ สุขใจ',
  D07:'นางสาวปิยนุช รักงาม', E04:'นางสาวอรทัย ศรีงาม', E09:'นางราตรี ผักสด'
};
const STAFF_OCCUPIED = new Set(['A01','A02','A03','A05','A06','A08','B02','B04','B07','C03','C06','D01','E09']);
const STAFF_RESERVED = new Set(['A04','B05','C08','D07','E04']);
const STAFF_ROWS = ['A','B','C','D','E'];

const DEMO: StaffData = {
  stalls: STAFF_ROWS.flatMap(row => Array.from({ length: 10 }, (_, i) => {
    const id = `${row}${String(i + 1).padStart(2, '0')}`;
    const status: StaffStall['status'] = STAFF_OCCUPIED.has(id) ? 'occupied' : STAFF_RESERVED.has(id) ? 'reserved' : 'available';
    return { id, row, status, tenantName: status === 'available' ? undefined : STAFF_TENANTS[id] };
  })),
  bills: [
    // ---- ค่าแผงประจำ ----
    { id:'INV-2569-08-018', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าเช่าแผง', month:'สิงหาคม 2569', due:'31 ส.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-08-019', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าขยะ', month:'สิงหาคม 2569', due:'31 ส.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-09-006', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าเช่าแผง', month:'กันยายน 2569', due:'ชำระแล้ว', amount:1200, status:'confirmed' },
    { id:'INV-2569-09-020', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-018', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-019', payerType:'stall', merchant:'นางสมใจ ใจดี', ref:'LM-021', stall:'A06', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-09-033', payerType:'stall', merchant:'นายบุญมี คำไหล', ref:'LM-025', stall:'A05', kind:'ค่าเช่าแผง', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-09-034', payerType:'stall', merchant:'นายบุญมี คำไหล', ref:'LM-025', stall:'A05', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-035', payerType:'stall', merchant:'นายบุญมี คำไหล', ref:'LM-025', stall:'A05', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-036', payerType:'stall', merchant:'นายบุญมี คำไหล', ref:'LM-025', stall:'A05', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-001', payerType:'stall', merchant:'นางสาวศิริพร ทองดี', ref:'LM-001', stall:'A01', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:1200, status:'confirmed' },
    { id:'INV-2569-10-002', payerType:'stall', merchant:'นางสาวศิริพร ทองดี', ref:'LM-001', stall:'A01', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:30, status:'confirmed' },
    { id:'INV-2569-10-003', payerType:'stall', merchant:'นายประเสริฐ ศรีสุข', ref:'LM-002', stall:'A02', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-004', payerType:'stall', merchant:'นายประเสริฐ ศรีสุข', ref:'LM-002', stall:'A02', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-09-005', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าเช่าแผง', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-09-007', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-008', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-009', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-010', payerType:'stall', merchant:'นางสาวกัญญา พิมพ์ดี', ref:'LM-028', stall:'A08', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-011', payerType:'stall', merchant:'นางสาวกัญญา พิมพ์ดี', ref:'LM-028', stall:'A08', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-022', payerType:'stall', merchant:'นางมะลิ แสงทอง', ref:'LM-008', stall:'B04', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:900, status:'pending' },
    { id:'INV-2569-10-023', payerType:'stall', merchant:'นางมะลิ แสงทอง', ref:'LM-008', stall:'B04', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-012', payerType:'stall', merchant:'นายวิทยา แซ่ลี้', ref:'LM-011', stall:'B02', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:900, status:'confirmed' },
    { id:'INV-2569-10-013', payerType:'stall', merchant:'นายวิทยา แซ่ลี้', ref:'LM-011', stall:'B02', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:30, status:'confirmed' },
    { id:'INV-2569-08-014', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าเช่าแผง', month:'สิงหาคม 2569', due:'31 ส.ค. 2569', amount:900, status:'unpaid' },
    { id:'INV-2569-08-015', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าขยะ', month:'สิงหาคม 2569', due:'31 ส.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-09-016', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าเช่าแผง', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:900, status:'unpaid' },
    { id:'INV-2569-09-017', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-101', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:900, status:'unpaid' },
    { id:'INV-2569-10-102', payerType:'stall', merchant:'นายสมชาย ไทยเจริญ', ref:'LM-013', stall:'B07', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-106', payerType:'stall', merchant:'นางสาวนภัส ใจงาม', ref:'LM-041', stall:'B05', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:900, status:'pending' },
    { id:'INV-2569-10-107', payerType:'stall', merchant:'นางสาวนภัส ใจงาม', ref:'LM-041', stall:'B05', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'pending' },
    { id:'INV-2569-10-025', payerType:'stall', merchant:'นายวิชัย ผักสด', ref:'LM-015', stall:'C03', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'mismatch' },
    { id:'INV-2569-10-103', payerType:'stall', merchant:'นางพัชรี ขำดี', ref:'LM-017', stall:'C06', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'unpaid' },
    { id:'INV-2569-10-104', payerType:'stall', merchant:'นางพัชรี ขำดี', ref:'LM-017', stall:'C06', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-108', payerType:'stall', merchant:'นายอนันต์ ทองสุข', ref:'LM-042', stall:'C08', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'unpaid' },
    { id:'INV-2569-10-105', payerType:'stall', merchant:'นางจันทร์เพ็ญ สุขใจ', ref:'LM-004', stall:'D01', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:1200, status:'confirmed' },
    { id:'INV-2569-10-109', payerType:'stall', merchant:'นางจันทร์เพ็ญ สุขใจ', ref:'LM-004', stall:'D01', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:30, status:'confirmed' },
    { id:'INV-2569-10-031', payerType:'stall', merchant:'นางราตรี ผักสด', ref:'LM-032', stall:'E09', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1050, status:'unpaid' },
    { id:'INV-2569-10-032', payerType:'stall', merchant:'นางราตรี ผักสด', ref:'LM-032', stall:'E09', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    // ---- แผงลอยนอกผัง ----
    { id:'INV-2569-10-201', payerType:'stall', merchant:'นางบัวผัน เจริญสุข', ref:'LP-01', location:'ลานหน้าตลาด', kind:'ค่าเช่าแผงลอย', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:500, status:'unpaid' },
    { id:'INV-2569-10-202', payerType:'stall', merchant:'นางสาวรัตนา ฟ้าใส', ref:'LC-02', location:'ลานชุมชน', kind:'ค่าเช่าแผงลอยรายวัน', month:'ตุลาคม 2569', due:'27 ต.ค. 2569', amount:80, status:'unpaid' },
    // ---- ค่าขยะครัวเรือน ----
    { id:'INV-HH-2569-10-014', payerType:'household', merchant:'นายสมชาย ใจบุญ', ref:'HH-014', location:'บ้านเลขที่ 18 หมู่ 2', houseNo:'18', moo:'2', phone:'0810000014', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-09-009', payerType:'household', merchant:'นายสมชาย ใจบุญ', ref:'HH-014', location:'บ้านเลขที่ 18 หมู่ 2', houseNo:'18', moo:'2', phone:'0810000014', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-021', payerType:'household', merchant:'นางสมใจ ใจดี', ref:'HH-021', location:'บ้านเลขที่ 7 หมู่ 3', houseNo:'7', moo:'3', phone:'0810000021', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-030', payerType:'household', merchant:'นางมะลิ แสงทอง', ref:'HH-030', location:'บ้านเลขที่ 18 หมู่ 5', houseNo:'18', moo:'5', phone:'0810000030', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-042', payerType:'household', merchant:'นายประยูร ทองดี', ref:'HH-042', location:'บ้านเลขที่ 12/3 หมู่ 2', houseNo:'12/3', moo:'2', phone:'0810000042', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
  ],
};
