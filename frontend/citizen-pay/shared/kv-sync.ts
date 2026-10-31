// เดโม่: ซิงก์ข้อมูลฝั่งประชาชน (คีย์ localStorage ด้านล่าง) ข้ามเครื่องผ่านตาราง demo_kv ใน Supabase
// ไม่มีค่า KV_CONFIG (ไม่ได้ตั้ง env / ระบบจริง) = ไม่ทำอะไรเลย · ดึงจากฐานกลางก่อน แล้วค่อยเขียนกลับเมื่อมีการเปลี่ยนแปลง
// ไฟล์นี้เป็น script ไม่ใช่ module (หน้า static รวมด้วย outFile) จึงห่อใน IIFE และตั้ง window.smartKvInit ให้หน้า Next เรียกได้
(function () {
  type KvConfig = { url: string; key: string };
  const KV_KEYS = ['market:payments', 'lamplaimat:demo-reservations', 'lamplaimat:demo-outside-apps', 'lamplaimat:demo-stalls', 'lamplaimat:outside-locations', 'market:rates'];
  const RELOAD_FLAG = 'kv:reloaded';

  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;
  let cfg: KvConfig | null = null;
  let pulling = false;
  let ready = false; // ยังไม่ดึงข้อมูลกลาง = ยังไม่ส่งอะไรขึ้น (กันทับข้อมูลใหม่ด้วยค่าเก่า)
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};

  const headersOf = (c: KvConfig) => ({ apikey: c.key, 'Content-Type': 'application/json' });

  function localValue(k: string): unknown {
    const raw = localStorage.getItem(k);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function push(k: string) {
    if (!cfg) return;
    const body = JSON.stringify([{ key: k, value: localValue(k), updated_at: new Date().toISOString() }]);
    fetch(`${cfg.url}/rest/v1/demo_kv`, { method: 'POST', headers: { ...headersOf(cfg), Prefer: 'resolution=merge-duplicates' }, body }).catch(() => { /* ส่งไม่ได้ = ค่าอยู่ในเครื่องนี้ */ });
  }

  function schedule(k: string) {
    if (pulling || !ready || !KV_KEYS.includes(k)) return;
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => push(k), 300);
  }

  function installShim() {
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) { rawSet.call(this, k, v); if (this === localStorage) schedule(k); };
    Storage.prototype.removeItem = function (this: Storage, k: string) { rawRemove.call(this, k); if (this === localStorage) schedule(k); };
  }

  /** ดึงข้อมูลกลางลงเครื่อง · ถ้ามีค่าเปลี่ยน (หน้าเปิดค่าไว้ตั้งแต่ก่อนดึง) โหลดหน้าใหม่ 1 ครั้ง */
  async function initKv(c?: KvConfig | null): Promise<void> {
    if (!c?.url || !c.key || typeof localStorage === 'undefined') return;
    cfg = c;
    installShim();
    try {
      const list = encodeURIComponent(KV_KEYS.map((k) => `"${k}"`).join(','));
      const r = await fetch(`${c.url}/rest/v1/demo_kv?select=key,value&key=in.(${list})`, { headers: headersOf(c), cache: 'no-store' });
      if (!r.ok) return;
      const remote = new Map(((await r.json()) as { key: string; value: unknown }[]).map((x) => [x.key, x.value]));
      let changed = false;
      pulling = true;
      try {
        for (const k of KV_KEYS) {
          if (remote.has(k)) {
            const v = remote.get(k);
            const next = v === null ? null : JSON.stringify(v);
            if (next === localStorage.getItem(k)) continue;
            changed = true;
            if (next === null) rawRemove.call(localStorage, k); else rawSet.call(localStorage, k, next);
          } else if (localStorage.getItem(k) !== null) push(k); // ฐานกลางยังไม่มีค่านี้ → ส่งของในเครื่องขึ้นไป
        }
      } finally { pulling = false; }
      ready = true;
      try {
        if (changed && !sessionStorage.getItem(RELOAD_FLAG)) { sessionStorage.setItem(RELOAD_FLAG, '1'); location.reload(); return; }
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch { /* โหมดส่วนตัว: ไม่รีโหลดซ้ำ */ }
    } catch { /* เชื่อมฐานกลางไม่ได้ → ใช้ข้อมูลในเครื่อง ไม่ส่งขึ้น */ }
  }

  const w = window as unknown as { KV_CONFIG?: KvConfig | null; smartKvInit?: (c?: KvConfig | null) => Promise<void> };
  w.smartKvInit = initKv;
  if (w.KV_CONFIG) void initKv(w.KV_CONFIG);
})();
