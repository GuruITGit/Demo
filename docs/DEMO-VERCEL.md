# เดโม่บน Vercel (ข้อมูลจำลอง · กดเพิ่ม/แก้/ลบได้เหมือนระบบจริง)

เดโม่ใช้ **หน้าเว็บชุดจริง** (`frontend/`) ไม่ใช่หน้าภาพนิ่ง — เปิดโหมดเดโม่ด้วย `NEXT_PUBLIC_DEMO_MODE=1`
แล้ว `lib/api.ts` จะสลับ axios ไปตอบจากข้อมูลจำลองในเบราว์เซอร์แทน backend (โค้ดอยู่ `frontend/src/lib/demo/`)
build ของ อบต. จริงไม่ตั้งตัวแปรนี้ → โค้ดเดโม่ไม่ติดไปกับ build จริง

## ตั้งค่า Vercel
- Root Directory = `frontend` · Framework = Next.js · ไม่ต้องมี backend/ฐานข้อมูล
- `frontend/vercel.json` ตั้ง `NEXT_PUBLIC_DEMO_MODE=1` ตอน build ให้แล้ว
- ทดสอบในเครื่อง: `cd frontend && NEXT_PUBLIC_DEMO_MODE=1 npm run dev`

## การทำงาน
- ข้อมูลตั้งต้น: `src/lib/demo/seed-base.ts` (องค์กร/กอง/ผู้ใช้/สิทธิ์) + `handlers/*.ts` (แต่ละโมดูล)
- เก็บในเบราว์เซอร์ (IndexedDB) — **แยกกันต่อเครื่อง/ต่อเบราว์เซอร์** รีเฟรชแล้วข้อมูลยังอยู่
- ปุ่ม "เดโม่" มุมซ้ายล่าง: สลับบัญชีทดลอง + รีเซ็ตข้อมูลตัวอย่าง · รหัสผ่านทุกบัญชี `demo1234`
- แก้ seed แล้วต้องเพิ่ม `DB_VERSION` ใน `src/lib/demo/core.ts` เครื่องที่เปิดไว้ก่อนจะรับข้อมูลชุดใหม่
- เพิ่ม endpoint ใหม่ = เพิ่ม `get/post/...` ใน handlers (รูปแบบตอบ `{success,data,meta}` เหมือน backend)
