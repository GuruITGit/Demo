type StallStatus = 'available' | 'reserved' | 'occupied';

interface PlanRow { id: string; count: number; monthlyRate?: number }
interface Stall { id: string; row?: string; locationId?: string; outside?: boolean; active?: boolean; deleted?: boolean; rentRate?: number; rentPeriod?: 'daily' | 'monthly'; tenantName?: string; status: StallStatus }
interface OutsideTenant { name: string; paid: boolean }
interface OutsideLocation { id: string; name: string; rentRate: number; rentPeriod: 'daily' | 'monthly'; enabled: boolean; deleted: boolean; tenants: OutsideTenant[]; openFrom?: string | null; openUntil?: string | null }
interface MarketEvent { id: string; title: string; date: string; month: string; place: string; slots: number; booked: number; fee: number }
interface DemoData {
  rates: { regularRent: number; stallWaste: number };
  outsideLocations: OutsideLocation[];
  planRows: PlanRow[];
  bills: Bill[];
  stalls: Stall[];
  events: MarketEvent[];
}
const MARKET_PLAN = ['A','B','C','D','E'].map((id,index)=>({id,count:10,monthlyRate:[1200,900,1500,1200,1050][index]}));
// ข้อมูลจำลอง: ผู้เช่า/ผู้จองของแต่ละล็อก (ชื่อสมมติ ไม่ใช่ข้อมูลจริง)
const TENANT_BY_STALL: Record<string,string> = {
  A01:'นางสาวศิริพร ทองดี', A02:'นายประเสริฐ ศรีสุข', A03:'นางอำไพ บุญรอด', A04:'นายธนพล วงศ์ษา', A05:'นายบุญมี คำไหล',
  A06:'นางสมใจ ใจดี', A08:'นางสาวกัญญา พิมพ์ดี', B02:'นายวิทยา แซ่ลี้', B04:'นางมะลิ แสงทอง', B05:'นางสาวนภัส ใจงาม',
  B07:'นายสมชาย ไทยเจริญ', C03:'นายวิชัย ผักสด', C06:'นางพัชรี ขำดี', C08:'นายอนันต์ ทองสุข', D01:'นางจันทร์เพ็ญ สุขใจ',
  D07:'นางสาวปิยนุช รักงาม', E04:'นางสาวอรทัย ศรีงาม', E09:'นางราตรี ผักสด'
};
const OCCUPIED_STALLS = new Set(['A01','A02','A03','A05','A06','A08','B02','B04','B07','C03','C06','D01','E09']);
const RESERVED_STALLS = new Set(['A04','B05','C08','D07','E04']);

const DEMO: DemoData = {
  rates: {regularRent:1200, stallWaste:30},
  outsideLocations: [
    {id:'LOC-01',name:'ลานหน้าตลาด',rentRate:500,rentPeriod:'monthly',enabled:true,deleted:false,tenants:[{name:'นางบัวผัน เจริญสุข',paid:false},{name:'นายทองใบ ศรีสว่าง',paid:true},{name:'นางสาวลัดดา แก้วกาญจน์',paid:true}]},
    {id:'LOC-02',name:'ลานชุมชน',rentRate:80,rentPeriod:'daily',enabled:true,deleted:false,tenants:[{name:'นางสาวรัตนา ฟ้าใส',paid:false},{name:'นายสุรชัย ทองคำ',paid:true}]}
  ],
  planRows: MARKET_PLAN,
  bills: [
    // ---- แผง A ----
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
    { id:'INV-2569-10-037', payerType:'stall', merchant:'นายธนพล วงศ์ษา', ref:'LM-004', stall:'A04', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-038', payerType:'stall', merchant:'นายธนพล วงศ์ษา', ref:'LM-004', stall:'A04', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-09-005', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าเช่าแผง', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-09-007', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-008', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-009', payerType:'stall', merchant:'นางอำไพ บุญรอด', ref:'LM-003', stall:'A03', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-010', payerType:'stall', merchant:'นางสาวกัญญา พิมพ์ดี', ref:'LM-028', stall:'A08', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1200, status:'unpaid' },
    { id:'INV-2569-10-011', payerType:'stall', merchant:'นางสาวกัญญา พิมพ์ดี', ref:'LM-028', stall:'A08', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    // ---- แผง B ----
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
    // ---- แผง C ----
    { id:'INV-2569-10-025', payerType:'stall', merchant:'นายวิชัย ผักสด', ref:'LM-015', stall:'C03', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'mismatch' },
    { id:'INV-2569-10-103', payerType:'stall', merchant:'นางพัชรี ขำดี', ref:'LM-017', stall:'C06', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'unpaid' },
    { id:'INV-2569-10-104', payerType:'stall', merchant:'นางพัชรี ขำดี', ref:'LM-017', stall:'C06', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    { id:'INV-2569-10-108', payerType:'stall', merchant:'นายอนันต์ ทองสุข', ref:'LM-042', stall:'C08', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1500, status:'unpaid' },
    // ---- แผง D ----
    { id:'INV-2569-10-105', payerType:'stall', merchant:'นางจันทร์เพ็ญ สุขใจ', ref:'LM-004', stall:'D01', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:1200, status:'confirmed' },
    { id:'INV-2569-10-109', payerType:'stall', merchant:'นางจันทร์เพ็ญ สุขใจ', ref:'LM-004', stall:'D01', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'ชำระแล้ว', amount:30, status:'confirmed' },
    // ---- แผง E ----
    { id:'INV-2569-10-031', payerType:'stall', merchant:'นางราตรี ผักสด', ref:'LM-032', stall:'E09', kind:'ค่าเช่าแผง', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:1050, status:'unpaid' },
    { id:'INV-2569-10-032', payerType:'stall', merchant:'นางราตรี ผักสด', ref:'LM-032', stall:'E09', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:30, status:'unpaid' },
    // ---- แผงลอยนอกผัง (ค้างตามผู้เช่าที่ยังไม่จ่าย) ----
    { id:'INV-2569-10-201', payerType:'stall', merchant:'นางบัวผัน เจริญสุข', ref:'LP-01', location:'ลานหน้าตลาด', kind:'ค่าเช่าแผงลอย', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:500, status:'unpaid' },
    { id:'INV-2569-10-202', payerType:'stall', merchant:'นางสาวรัตนา ฟ้าใส', ref:'LC-02', location:'ลานชุมชน', kind:'ค่าเช่าแผงลอยรายวัน', month:'ตุลาคม 2569', due:'27 ต.ค. 2569', amount:80, status:'unpaid' },
  ],
  stalls: MARKET_PLAN.flatMap(row=>Array.from({length:row.count},(_,i)=>{const id=`${row.id}${String(i+1).padStart(2,'0')}`;const status:StallStatus=OCCUPIED_STALLS.has(id)?'occupied':RESERVED_STALLS.has(id)?'reserved':'available';return {id,row:row.id,active:true,status,tenantName:status==='available'?undefined:TENANT_BY_STALL[id]}})),
  events: [
    {id:'EV-092',title:'ตลาดนัดของดีชุมชน',date:'26',month:'ต.ค.',place:'ลานอเนกประสงค์',slots:24,booked:18,fee:90},
    {id:'EV-095',title:'งานลอยกระทง',date:'05',month:'พ.ย.',place:'ลานหน้าที่ทำการ อบต.',slots:40,booked:12,fee:120}
  ]
};
