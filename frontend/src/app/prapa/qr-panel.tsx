/** จอ QR พร้อมเพย์ในจุดรับเงิน — เจ้าหน้าที่ยื่นให้ผู้ใช้น้ำสแกนจ่าย แล้วเช็กเงินเข้าบัญชีก่อนยืนยัน */
export function QrPanel({ data, amount }: { data: any; amount: string }) {
  if (data && !data.hasPromptpay) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-700">
        ยังไม่ได้ตั้งเลขพร้อมเพย์ — ตั้งที่หน้า “ตั้งค่าเรต + พร้อมเพย์”
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-3 text-center">
      {data?.qr ? (
        <>
          <p className="text-xs font-medium text-slate-600">ให้ผู้ใช้น้ำสแกนจ่าย</p>
          <img src={data.qr} alt="QR พร้อมเพย์" className="mx-auto my-1.5 h-40 w-40" />
          <p className="text-xs text-slate-500">{data.payeeName || 'พร้อมเพย์'} · {amount} บาท</p>
          <p className="mt-0.5 text-[11px] text-amber-600">*สแกนแล้วเช็กเงินเข้าบัญชี อบต. ก่อนกดยืนยันรับเงิน</p>
        </>
      ) : (
        <p className="py-6 text-xs text-slate-400">กำลังสร้าง QR…</p>
      )}
    </div>
  );
}
