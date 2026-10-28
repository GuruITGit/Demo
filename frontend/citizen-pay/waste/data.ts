// ข้อมูลตัวอย่างค่าขยะบ้าน (ยังไม่มี backend) — ค้นหาได้ด้วย บ้านเลขที่+หมู่ / ชื่อ / เบอร์โทร (เบอร์ตัวอย่าง 081-000-xxxx)
const DEMO: { bills: Bill[] } = {
  bills: [
    { id:'INV-HH-2569-10-014', payerType:'household', merchant:'สมชาย ใจบุญ', ref:'HH-014', location:'บ้านเลขที่ 18 หมู่ 2', houseNo:'18', moo:'2', phone:'0810000014', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-09-009', payerType:'household', merchant:'สมชาย ใจบุญ', ref:'HH-014', location:'บ้านเลขที่ 18 หมู่ 2', houseNo:'18', moo:'2', phone:'0810000014', kind:'ค่าขยะ', month:'กันยายน 2569', due:'30 ก.ย. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-021', payerType:'household', merchant:'สมใจ ใจดี', ref:'HH-021', location:'บ้านเลขที่ 7 หมู่ 3', houseNo:'7', moo:'3', phone:'0810000021', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-030', payerType:'household', merchant:'มะลิ แสงทอง', ref:'HH-030', location:'บ้านเลขที่ 18 หมู่ 5', houseNo:'18', moo:'5', phone:'0810000030', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' },
    { id:'INV-HH-2569-10-042', payerType:'household', merchant:'ประยูร ทองดี', ref:'HH-042', location:'บ้านเลขที่ 12/3 หมู่ 2', houseNo:'12/3', moo:'2', phone:'0810000042', kind:'ค่าขยะ', month:'ตุลาคม 2569', due:'31 ต.ค. 2569', amount:40, status:'unpaid' }
  ]
};
