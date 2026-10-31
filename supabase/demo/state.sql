-- เดโม่ (Vercel): เก็บสถานะทั้งระบบเป็นแถวเดียวใน Supabase เพื่อให้ทุกเครื่องเห็นข้อมูลชุดเดียวกัน
-- ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ห้ามใส่ข้อมูลจริงของประชาชนในโปรเจกต์นี้
-- ใช้กับ anon key ในเบราว์เซอร์ จึงเปิดอ่าน/เขียนเฉพาะแถว id = 'main' เท่านั้น

create table if not exists demo_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table demo_state enable row level security;

drop policy if exists "demo state read" on demo_state;
create policy "demo state read" on demo_state for select to anon, authenticated using (id = 'main');
drop policy if exists "demo state insert" on demo_state;
create policy "demo state insert" on demo_state for insert to anon, authenticated with check (id = 'main');
drop policy if exists "demo state update" on demo_state;
create policy "demo state update" on demo_state for update to anon, authenticated using (id = 'main') with check (id = 'main');
