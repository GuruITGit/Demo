-- ระบบเดโม่ค่าแผงตลาดและค่าเก็บขยะบ้าน บน Supabase
-- ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ห้ามใส่ข้อมูลจริงของประชาชนในโปรเจกต์นี้

create extension if not exists pgcrypto;

create table if not exists market_stalls (
  id uuid primary key default gen_random_uuid(),
  stall_code text not null unique,
  zone text not null,
  status text not null default 'available' check (status in ('available','reserved','occupied')),
  tenant_name text,
  monthly_rate numeric(10,2) not null default 0,
  active boolean not null default true
);

create table if not exists market_bills (
  id uuid primary key default gen_random_uuid(),
  stall_code text not null references market_stalls(stall_code),
  payer_name text not null,
  kind text not null check (kind in ('rent','waste')),
  period text not null,            -- พ.ศ.-เดือน เช่น 2569-10
  amount numeric(10,2) not null,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid','pending','paid','mismatch')),
  paid_method text check (paid_method in ('cash','qr','transfer')),
  paid_at timestamptz,
  receipt_no text,
  unique (stall_code, kind, period)
);

create table if not exists waste_bills (
  id uuid primary key default gen_random_uuid(),
  household_ref text not null,
  holder_name text not null,
  house_no text not null,
  moo text not null,
  phone text,
  period text not null,
  amount numeric(10,2) not null,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_method text check (paid_method in ('cash','qr','transfer')),
  paid_at timestamptz,
  receipt_no text,
  unique (household_ref, period)
);

-- สิทธิ์ของหน้าเดโม่ (anon key): อ่านได้ทั้งหมด · แก้สถานะบิลได้ เพื่อให้ทดลองรับชำระ
alter table market_stalls enable row level security;
alter table market_bills enable row level security;
alter table waste_bills enable row level security;

drop policy if exists "demo read stalls" on market_stalls;
create policy "demo read stalls" on market_stalls for select to anon, authenticated using (true);
drop policy if exists "demo read market bills" on market_bills;
create policy "demo read market bills" on market_bills for select to anon, authenticated using (true);
drop policy if exists "demo update market bills" on market_bills;
create policy "demo update market bills" on market_bills for update to anon, authenticated using (true) with check (true);
drop policy if exists "demo read waste bills" on waste_bills;
create policy "demo read waste bills" on waste_bills for select to anon, authenticated using (true);
drop policy if exists "demo update waste bills" on waste_bills;
create policy "demo update waste bills" on waste_bills for update to anon, authenticated using (true) with check (true);
