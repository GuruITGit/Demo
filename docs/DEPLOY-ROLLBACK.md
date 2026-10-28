# Deploy + Rollback — ระบบประปา/multi-tenant (ก.ย. 2569)

Runbook สำหรับ deploy งานชุดล่าสุดขึ้น prod (INET) แบบ **มีทางถอยเสมอ** — เผื่อ migration หรือโค้ดใหม่พัง

งานชุดนี้มี **migration ใหม่ 6 ตัว** (`1700000052`–`57`): เรตรายคน · ประวัติแก้เลขมาตร ·
ข้อมูลหน่วยงานประปา · หนังสือแจ้งค้างชำระ · username unique ต่อ org · โดเมนต่อ org
ทุกตัวมี `down()` และทดสอบ revert→re-apply บน local ผ่านแล้ว

---

## ⭐ กฎทอง — ก่อน deploy ทุกครั้ง เก็บ "จุดถอย" 2 อย่าง

```bash
cd ~/smartgov

# 1) จำ commit ปัจจุบัน (โค้ดที่ prod รันอยู่ตอนนี้ = จุดถอยของโค้ด)
git rev-parse --short HEAD | tee /tmp/rollback-commit.txt

# 2) dump ฐานข้อมูลสดเดี๋ยวนี้ (จุดถอยของข้อมูล — ก่อน migration รัน)
cd infrastructure
docker compose exec -T postgres pg_dump -U postgres -Fc smartgov > ~/pre-deploy-$(date +%Y%m%d-%H%M).dump
ls -lh ~/pre-deploy-*.dump    # ต้องมีขนาด > 0
```

> มี 2 อย่างนี้ในมือ = ถอยกลับสภาพเดิมได้ 100% ไม่ว่าอะไรพัง

---

## Deploy

```bash
cd ~/smartgov
git pull                                  # ได้ commit ce4a277/8412ab9 ล่าสุด
cd infrastructure
docker compose build backend frontend
docker compose up -d backend frontend
```

- migration รันอัตโนมัติตอน backend สตาร์ท (`node dist/run-migrations.js && node dist/main.js`)
- ถ้า migration ตัวใดตัวหนึ่ง fail → container exit → **เว็บ 502** (นี่คือกรณีที่ต้อง rollback)

### เช็คหลัง deploy (2 นาที)
```bash
docker compose logs backend | tail -30           # หา "✓ รัน migration 6 รายการ: ..." · ไม่มี "✗ รัน migration ไม่สำเร็จ"
docker compose ps                                # backend = running (ไม่ใช่ restarting)
curl -s -o /dev/null -w "%{http_code}\n" https://sao-lamnangrong.com/   # ต้อง 200
```
แล้วลองจริง: เปิด `https://sao-lamnangrong.com` → login เจ้าหน้าที่ได้ · เปิดสารบรรณ + /prapa ได้

---

## 🔴 Rollback (ถ้าพัง)

### กรณี A — migration fail / เว็บ 502 / ข้อมูลเพี้ยน (ถอยเต็ม — ชัวร์สุด)

ถอยทั้งโค้ดและข้อมูลกลับจุดก่อน deploy:

```bash
cd ~/smartgov
docker compose -f infrastructure/docker-compose.yml stop backend    # กันเขียนเพิ่ม

# 1) ถอยโค้ดกลับ commit เดิม
git checkout $(cat /tmp/rollback-commit.txt)

# 2) กู้ฐานข้อมูลกลับ dump ก่อน deploy (ล้าง schema ใหม่ + ข้อมูลกลับจุดเดิม)
cd infrastructure
cat ~/pre-deploy-*.dump | docker compose exec -T postgres pg_restore -U postgres -d smartgov --clean --if-exists --no-owner

# 3) build + start จากโค้ดเก่า
docker compose build backend frontend && docker compose up -d
```
→ กลับสภาพก่อน deploy เป๊ะ (โค้ดเก่า + ข้อมูลเก่า + ไม่มีคอลัมน์ใหม่)

### กรณี B — โค้ดใหม่มีบั๊กแต่ migration ผ่านแล้ว/ข้อมูลปกติ (ถอยแค่โค้ด)

ถ้า migration รันไปแล้วและข้อมูลไม่เสีย แค่ฟีเจอร์ใหม่มีปัญหา — **ไม่ต้องแตะ DB** (คอลัมน์ใหม่ที่เพิ่มไม่กระทบโค้ดเก่า เพราะเป็นการ "เพิ่ม" ล้วน):

```bash
cd ~/smartgov
git checkout $(cat /tmp/rollback-commit.txt)
cd infrastructure && docker compose build backend frontend && docker compose up -d
```
> คอลัมน์ใหม่ (unit_price, hostnames, edit_history ฯลฯ) โค้ดเก่าไม่ได้ใช้ → อยู่เฉยๆ ไม่พัง
> **ยกเว้น** migration 56 (username unique ต่อ org): ถ้าถอยโค้ดแต่คง constraint นี้ไว้ = ยังทำงานปกติ (เข้มกว่าเดิมนิดเดียว) ไม่ต้องถอย DB

> ℹ️ **บน prod ไม่มีคำสั่ง revert migration ทีละตัว** — `run-migrations.js` เดินหน้าอย่างเดียว
> การถอย schema บน prod = **กู้ dump (กรณี A)** เท่านั้น (ปลอดภัยสุด ถอยทั้งก้อนพร้อมกัน)
> `down()` ของแต่ละ migration ทดสอบ revert→re-apply บน local ผ่านแล้ว (เผื่อต้องถอยแบบละเอียดบนเครื่อง dev)

---

## ⚠️ ยังไม่ได้เทส 2 อย่าง (ควรทำก่อน/ระหว่าง deploy)

1. **migration กับข้อมูลจริงแบบ prod** — local เป็น org ตัวอย่าง ไม่ใช่ 2,739 ราย + constraint ชื่อจริง
   → **ทดสอบ migration บนสำเนา prod ก่อน** (ใช้ backup drill ที่ซ้อมไว้):
   ```bash
   cd ~/smartgov/infrastructure
   docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS smartgov_mig;"
   docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE smartgov_mig;"
   cat ~/pre-deploy-*.dump | docker compose exec -T postgres pg_restore -U postgres -d smartgov_mig --no-owner
   # รัน migration ชี้ DB สำเนา (ตั้ง DB_DATABASE=smartgov_mig ชั่วคราว) แล้วดูว่าผ่านครบ 6 ตัวไม่ error
   docker compose exec -T -e DB_DATABASE=smartgov_mig backend node dist/run-migrations.js
   # เช็คไม่พัง แล้วลบ
   docker compose exec -T postgres psql -U postgres -c "DROP DATABASE smartgov_mig;"
   ```
   ถ้า 6 ตัวผ่านบนสำเนา prod = มั่นใจ deploy ของจริงได้
2. **คลิกทดสอบ UI จริง** — login/สารบรรณ/prapa/ตั้งค่า/onboard บนเบราว์เซอร์

---

## หมายเหตุ
- ลำนางรอง **ไม่กระทบ**: migration เป็นการเพิ่มคอลัมน์/constraint + backfill (`sao-lamnangrong.com`, ค่าหนังสือเดิม) — โดเมน/username เดิมใช้ได้เหมือนเดิม
- migration ทั้งหมด idempotent (`IF NOT EXISTS`, หา constraint ไดนามิก) — รันซ้ำได้ไม่พัง
- backup อัตโนมัติทุกคืน 02:30 ยังทำงาน — pre-deploy dump เป็นตัวเสริมเฉพาะกิจ
