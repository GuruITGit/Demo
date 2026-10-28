'use client';
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

/** หน้าสำหรับประชาชน — แสดงหน้าตามาตรฐานเสมอ ไม่ขึ้นกับการตั้งค่าการแสดงผลของเจ้าหน้าที่ */
const PUBLIC_PATHS = /^\/(citizen|checkbill)(\/|$)/;

type FontSize = 'normal' | 'large' | 'xlarge';
type Mode = 'light' | 'dark';
type Font = 'sarabun' | 'plex' | 'anuphan' | 'noto';

/** ฟอนต์ไทยให้เลือก (พร้อมตัวอย่างให้เห็นหน้าตาจริง) — label render ด้วยฟอนต์ตัวเอง */
export const FONTS: { key: Font; label: string; cssVar: string }[] = [
  { key: 'sarabun', label: 'Sarabun (ราชการ)', cssVar: 'var(--font-sarabun)' },
  { key: 'plex',    label: 'IBM Plex Sans Thai', cssVar: 'var(--font-plex)' },
  { key: 'anuphan', label: 'Anuphan',            cssVar: 'var(--font-anuphan)' },
  { key: 'noto',    label: 'Noto Sans Thai',     cssVar: 'var(--font-noto)' },
];

/** ธีมสีของระบบ (โทนราชการ เหมาะกับ อบต.) — สลับได้ ใช้ร่วมกับโหมดสว่าง/มืดได้ทุกสี */
export const THEMES = [
  { key: 'blue',    label: 'น้ำเงิน',     swatch: '#2563eb' },
  { key: 'emerald', label: 'เขียว',       swatch: '#059669' },
  { key: 'teal',    label: 'เขียวหิน',    swatch: '#0d9488' },
  { key: 'cyan',    label: 'ฟ้าน้ำทะเล',  swatch: '#0891b2' },
  { key: 'sky',     label: 'ฟ้าใส',       swatch: '#0284c7' },
  { key: 'indigo',  label: 'กรมท่า',      swatch: '#4f46e5' },
  { key: 'violet',  label: 'ม่วง',        swatch: '#7c3aed' },
  { key: 'fuchsia', label: 'บานเย็น',     swatch: '#c026d3' },
  { key: 'rose',    label: 'กุหลาบ',      swatch: '#e11d48' },
  { key: 'maroon',  label: 'เลือดหมู',    swatch: '#b11e44' },
  { key: 'amber',   label: 'อำพัน',       swatch: '#d97706' },
] as const;

export type Theme = (typeof THEMES)[number]['key'];

interface AccessibilityCtx {
  fontSize: FontSize;
  mode: Mode;
  theme: Theme;
  font: Font;
  setFontSize: (s: FontSize) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setTheme: (t: Theme) => void;
  setFont: (f: Font) => void;
}

const Ctx = createContext<AccessibilityCtx>({
  fontSize: 'normal',
  mode: 'light',
  theme: 'blue',
  font: 'sarabun',
  setFontSize: () => {},
  setMode: () => {},
  toggleMode: () => {},
  setTheme: () => {},
  setFont: () => {},
});

const SIZES: Record<FontSize, string> = {
  normal: '16px',
  large: '18px',
  xlarge: '21px',
};

type Prefs = { fontSize: FontSize; mode: Mode; theme: Theme; font: Font };
const DEFAULT_PREFS: Prefs = { fontSize: 'normal', mode: 'light', theme: 'emerald', font: 'sarabun' };
const STORAGE_KEY = 'sg-a11y';

/**
 * ค่าการแสดงผลเก็บใน localStorage — อ่านผ่าน useSyncExternalStore (ไม่ต้อง setState ใน effect)
 * ฝั่ง server/ตอน hydrate ใช้ค่าเริ่มต้น แล้วค่อยสลับเป็นค่าที่บันทึกไว้ · แท็บอื่นเปลี่ยนค่า = แท็บนี้ตามด้วย (event storage)
 */
let cachedRaw: string | null | undefined;
let cachedPrefs: Prefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

function readPrefs(): Prefs {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch {}
  if (raw === cachedRaw) return cachedPrefs; // snapshot ต้องคงที่ถ้าค่าไม่เปลี่ยน
  cachedRaw = raw;
  const p: Prefs = { ...DEFAULT_PREFS };
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed) {
      if (parsed.f) p.fontSize = parsed.f;
      // v2: default ระบบเปลี่ยนเป็นน้ำเงินราชการ — ข้อมูลเก่า (ไม่มี v) ที่เป็น emerald คือ default เดิม ไม่ใช่การเลือก → ใช้ blue
      if (parsed.t && parsed.v >= 2) p.theme = parsed.t;
      if (parsed.fo) p.font = parsed.fo;
      // m = โหมดใหม่ (light/dark); c = ค่าเดิม (high-contrast) → map เป็น dark เพื่อ back-compat
      if (parsed.m) p.mode = parsed.m;
      else if (parsed.c === 'high') p.mode = 'dark';
    }
  } catch {}
  cachedPrefs = p;
  return p;
}

function writePrefs(next: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, f: next.fontSize, m: next.mode, t: next.theme, fo: next.font }));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, readPrefs, () => DEFAULT_PREFS);
  const { fontSize, mode, theme, font } = prefs;

  // หน้าประชาชน (หน้าบ้าน) มีโทนสีของตัวเอง — ไม่รับโหมดมืด/ธีม/ฟอนต์/ขนาดตัวอักษรที่เจ้าหน้าที่ตั้งไว้
  // (ใช้ localStorage เดียวกันเพราะโดเมนเดียวกัน → เดิมเจ้าหน้าที่เปิดโหมดมืดแล้วหน้าประชาชนมืดตามจนอ่านไม่ออก)
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.test(pathname || '');

  useEffect(() => {
    const el = document.documentElement;
    if (isPublic) {
      el.style.fontSize = SIZES.normal;
      el.setAttribute('data-mode', 'light');
      el.removeAttribute('data-theme');
      el.removeAttribute('data-font');
      return;
    }
    el.style.fontSize = SIZES[fontSize];
    el.setAttribute('data-mode', mode);
    el.setAttribute('data-theme', theme);
    el.setAttribute('data-font', font);
  }, [fontSize, mode, theme, font, isPublic]);

  const update = (patch: Partial<Prefs>) => writePrefs({ ...readPrefs(), ...patch });
  const setFontSize = (s: FontSize) => update({ fontSize: s });
  const setMode = (m: Mode) => update({ mode: m });
  const toggleMode = () => update({ mode: readPrefs().mode === 'light' ? 'dark' : 'light' });
  const setTheme = (t: Theme) => update({ theme: t });
  const setFont = (fo: Font) => update({ font: fo });

  return (
    <Ctx.Provider value={{ fontSize, mode, theme, font, setFontSize, setMode, toggleMode, setTheme, setFont }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAccessibility() { return useContext(Ctx); }
