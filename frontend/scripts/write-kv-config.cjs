// เขียน public/citizen-pay/shared/kv-config.js ตอน build: มี env ของ Supabase = ซิงก์ข้ามเครื่อง · ไม่มี = null (ไม่ซิงก์)
const fs = require('fs');
const path = require('path');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const out = path.join(__dirname, '..', 'public', 'citizen-pay', 'shared', 'kv-config.js');
fs.writeFileSync(out, `window.KV_CONFIG = ${url && key ? JSON.stringify({ url, key }) : 'null'};\n`);
console.log('kv-config:', url && key ? 'Supabase' : 'off');
