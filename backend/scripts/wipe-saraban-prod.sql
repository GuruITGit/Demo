-- ═══════════════════════════════════════════════════════════════════════════
-- ล้างเรื่องสารบรรณเก่าทั้งหมด เริ่มใหม่ด้วย workflow v4 (rework/saraban-v4)
-- ⚠️ รันด้วยมือตอน deploy v4 บน prod เท่านั้น — ลบเรื่องสารบรรณทั้งหมด กู้คืนไม่ได้
-- ไม่ใช่ migration (ไม่อยู่ในชุด migration:run) — ตั้งใจให้รันแยกเมื่อพร้อม
--
-- วิธีรัน (บน prod, ใช้ env ของ prod):
--   psql "$DATABASE_URL" -f scripts/wipe-saraban-prod.sql
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1) ไฟล์แนบของสารบรรณ (refType='ticket') — ลบ record (ไฟล์ใน storage ล้างต่างหากถ้าต้องการ)
DELETE FROM file_uploads
 WHERE ref_type = 'ticket'
   AND ref_id IN (SELECT id FROM correspondence_tickets);

-- 2) ไทม์ไลน์/ประวัติการทำงานของสารบรรณ
DELETE FROM document_workflow_logs WHERE doc_type = 'TICKET';

-- 3) มอบหมายกอง (ลูกของ ticket)
DELETE FROM correspondence_ticket_departments;

-- 4) ตัวสารบรรณเอง
DELETE FROM correspondence_tickets;

-- 5) (ทางเลือก) รีเซ็ต running number ของสารบรรณ — v4 กรอกเลขทะเบียนรับเอง จึงไม่จำเป็น
--    ถ้าต้องการล้าง ให้ uncomment (คอลัมน์จริง: organization_id, doc_type, year, prefix, current_number)
-- DELETE FROM document_number_sequences WHERE doc_type ILIKE '%ticket%';

COMMIT;

-- ตรวจผล: ควรได้ 0 ทุกตาราง
-- SELECT count(*) FROM correspondence_tickets;
-- SELECT count(*) FROM correspondence_ticket_departments;
-- SELECT count(*) FROM document_workflow_logs WHERE doc_type='TICKET';
