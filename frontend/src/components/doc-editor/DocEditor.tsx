'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Type, Heading, CheckSquare, Minus, Square, ImagePlus, PenLine, Stamp, ListChecks,
  Undo2, Redo2, ZoomIn, ZoomOut, Trash2, Copy, X, Upload, Lock,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { SignatureDrawer } from '@/components/shared/signature-drawer';
import { ItemContent, TYPE_LABEL, textStyle, stampValues, checklistRows } from './elements';
import {
  A4H, A4W, FIELD_DEFS, INK, PT_SIZES, clamp, makeItem, newId, ptToPx, pxToPt,
  type DocContext, type DocItem, type DocPage, type ItemType,
} from './types';

// ─────────────────────────────── ประวัติ (undo/redo) ───────────────────────────────
type Hist = { past: DocItem[][]; present: DocItem[]; future: DocItem[][] };
const MAX_HISTORY = 60;

/** state ของชิ้นส่วนพร้อม undo/redo — set(…, false) = อัปเดตระหว่างลาก ไม่บันทึกประวัติ */
export function useDocHistory(initial: DocItem[] = []) {
  const [h, setH] = useState<Hist>({ past: [], present: initial, future: [] });
  const set = useCallback((next: DocItem[] | ((p: DocItem[]) => DocItem[]), commit = true) => {
    setH((s) => {
      const v = typeof next === 'function' ? next(s.present) : next;
      if (v === s.present) return s;
      return commit ? { past: [...s.past, s.present].slice(-MAX_HISTORY), present: v, future: [] } : { ...s, present: v };
    });
  }, []);
  /** บันทึกจุดย้อนกลับ (ใช้ตอนลากเสร็จ — snapshot ก่อนลาก) */
  const checkpoint = useCallback((snap: DocItem[]) => {
    setH((s) => (snap === s.present ? s : { past: [...s.past, snap].slice(-MAX_HISTORY), present: s.present, future: [] }));
  }, []);
  const undo = useCallback(() => setH((s) => (s.past.length
    ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setH((s) => (s.future.length
    ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), []);
  const reset = useCallback((v: DocItem[]) => setH({ past: [], present: v, future: [] }), []);
  return { items: h.present, set, checkpoint, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
export type DocHistory = ReturnType<typeof useDocHistory>;

// ─────────────────────────────── export (HTML ของชั้นที่แต่ง) ───────────────────────────────
const toDataUrl = async (src: string) => {
  if (!src || src.startsWith('data:')) return src;
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
  } catch { return ''; }
};

/** คัดลอก HTML ชั้นที่แต่งของทุกหน้า (ตัดตัวช่วยแก้ไขออก รูปทุกรูปเป็น data URL) สำหรับส่งไปทำ PDF */
export async function collectExportPages(root: HTMLElement, pages: DocPage[]) {
  return Promise.all(pages.map(async (p, i) => {
    const layer = root.querySelector(`[data-export-layer="${i}"]`);
    let html = '';
    if (layer) {
      const clone = layer.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-editor-only]').forEach((n) => n.remove());
      clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
      clone.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
      await Promise.all([...clone.querySelectorAll('img')].map(async (img) => { img.src = await toDataUrl(img.getAttribute('src') || ''); }));
      html = clone.innerHTML;
    }
    return { src: p.src, srcPage: p.srcPage, html };
  }));
}

// ─────────────────────────────── ตัวแก้ไข ───────────────────────────────
export interface TimelineSignature { id: string; sig: string; name: string; pos: string }

interface Props {
  pages: DocPage[];
  /** ภาพของหน้าไฟล์แนบ (index = srcPage) */
  attachmentImages: string[];
  history: DocHistory;
  ctx: DocContext;
  /** ปุ่ม "อัปโหลดเอกสาร" — เปลี่ยนพื้นหลังเป็นไฟล์ที่เลือก (PDF/รูป) */
  onUploadDocument?: (file: File) => void;
  uploading?: boolean;
  /** ดูอย่างเดียว (ไม่ใช่ผู้ถือเรื่อง / เรื่องจบแล้ว) — ซ่อนแผงเครื่องมือ ลาก/แก้ไม่ได้ */
  readOnly?: boolean;
  /** ย้าย/ย่อขยายลายเซ็นของคนอื่นได้ (นายก — จัดวางให้สวยก่อนปิดงาน) แต่ลบ/แก้ไม่ได้ */
  canMoveOthers?: boolean;
  /** แสดงปุ่มตราเลขรับ/กองที่เกี่ยวข้อง (เฉพาะเอกสารที่ผูกกับเรื่องสารบรรณ) */
  ticketTools?: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  header?: ReactNode;
  actions?: ReactNode;
}

type Drag = {
  mode: 'move' | 'resize'; id: string; sx: number; sy: number; grabDx: number; grabDy: number;
  origin: Record<string, { x: number; y: number; w: number; h: number; page: number }>; start: DocItem[];
};
type Guides = { page: number; xs: number[]; ys: number[] } | null;
const SNAP = 0.8; // % ของหน้า

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/** ย่อรูปก่อนเก็บลงเอกสาร (เก็บเป็น data URL ใน layout — กัน payload ใหญ่) */
function readImage(file: File, max = 900): Promise<{ src: string; ratio: number }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        const png = file.type === 'image/png';
        res({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), ratio: im.height / im.width });
      };
      im.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

export function DocEditor({ pages, attachmentImages, history, ctx, onUploadDocument, uploading, readOnly, canMoveOthers, ticketTools, canvasRef, header, actions }: Props) {
  const { items, set } = history;
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [guides, setGuides] = useState<Guides>(null);
  const [sigModal, setSigModal] = useState<null | { at?: { page: number; x: number; y: number } }>(null);
  const [imgTarget, setImgTarget] = useState<string | null>(null); // แทนรูปเดิม
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const itemsRef = useRef(items);
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // ── ลายเซ็นของฉัน (จากเมนูจัดการลายเซ็น) — วางได้เฉพาะของตัวเอง ลายเซ็นคนอื่นแตะไม่ได้ ──
  const qc = useQueryClient();
  const me = useAuthStore((st) => st.user);
  const meId = me?.id;
  // ลายเซ็นที่บันทึกไว้ในเมนู "จัดการลายเซ็น" (/signatures) — เก็บที่โปรไฟล์ผู้ใช้ (metadata.signatureImage) ที่เดียวกัน
  const { data: mySig } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await api.get('/auth/me')).data.data,
    enabled: !!meId,
    select: (u: any) => (u?.metadata?.signatureImage as string | undefined) || '',
  });
  const foreign = (it: DocItem) => it.type === 'signature' && !!it.props?.ownerId && it.props.ownerId !== meId;
  /** แก้/ลบไม่ได้ */
  const noEdit = (it: DocItem) => !!readOnly || !!it.locked || foreign(it);
  /** ย้าย/ย่อขยายไม่ได้ (นายกย้ายลายเซ็นคนอื่นได้) */
  const noMove = (it: DocItem) => !!readOnly || !!it.locked || (foreign(it) && !canMoveOthers);
  const mySigProps = (sig: string) => ({ sig, name: ctx.fields['me.name'] ? `(${ctx.fields['me.name']})` : '', pos: ctx.fields['me.position'] || '', ownerId: meId });
  const placeMySig = (sig: string, at?: { page: number; x: number; y: number }) => {
    if (!at) { addKind('signature', mySigProps(sig)); return; }
    const it = makeItem('signature', at.page, 0, 0, mySigProps(sig));
    add({ ...it, x: clamp(at.x - it.w / 2, 0, 100 - it.w), y: clamp(at.y - it.h / 2, 0, 100 - it.h) });
  };
  const addMySig = (at?: { page: number; x: number; y: number }) => { if (mySig) placeMySig(mySig, at); else setSigModal({ at }); };
  /** เซ็นครั้งแรก → เก็บเป็น "ลายเซ็นของฉัน" แล้ววางลงเอกสาร */
  const saveFirstSig = async (dataUrl: string) => {
    try {
      await api.patch('/auth/me', { signatureImage: dataUrl });
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      placeMySig(dataUrl, sigModal?.at);
      setSigModal(null);
      toast.success('บันทึกลายเซ็นของคุณแล้ว — ครั้งต่อไปกดวางได้เลย');
    } catch (e) { toast.error(getErrorMessage(e, 'บันทึกลายเซ็นไม่สำเร็จ')); }
  };
  const onPickDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f || !onUploadDocument) return;
    if (itemsRef.current.length && !confirm('เปลี่ยนเอกสารพื้นหลังเป็นไฟล์นี้? (ข้อความ/ลายเซ็นที่วางไว้ยังอยู่)')) return;
    onUploadDocument(f);
  };

  const selected = items.filter((i) => sel.includes(i.id));
  const one = selected.length === 1 ? selected[0] : null;

  const patch = (id: string, change: Partial<DocItem> | ((it: DocItem) => Partial<DocItem>)) =>
    set((arr) => arr.map((it) => (it.id === id ? { ...it, ...(typeof change === 'function' ? change(it) : change) } : it)));
  const patchProps = (id: string, props: Record<string, any>) => patch(id, (it) => ({ props: { ...it.props, ...props } }));

  // ── เพิ่มชิ้น ──
  const add = (it: DocItem) => { set((arr) => [...arr, it]); setSel([it.id]); };
  const addKind = (kind: ItemType | 'heading', props: Record<string, any> = {}) => {
    const n = itemsRef.current.filter((i) => i.page === activePage).length % 8;
    add(makeItem(kind, Math.min(activePage, pages.length - 1), 8 + n * 3, 8 + n * 3, props));
  };
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const { src, ratio } = await readImage(f);
    if (imgTarget) { patchProps(imgTarget, { src }); setImgTarget(null); return; }
    const w = 30, h = clamp(w * ratio * (A4W / A4H), 2, 60);
    add({ ...makeItem('image', activePage, 10, 10, { src }), w, h });
  };

  // ── ลากจากแผงชิ้นส่วนลงหน้า ──
  const onDropPage = (e: React.DragEvent, page: number) => {
    const kind = e.dataTransfer.getData('application/x-doc-kind') as ItemType | 'heading';
    if (!kind || readOnly) return;
    e.preventDefault();
    if (kind === 'image') { setActivePage(page); fileInput.current?.click(); return; }
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * 100, py = ((e.clientY - box.top) / box.height) * 100;
    if (kind === 'signature') { setActivePage(page); addMySig({ page, x: px, y: py }); return; }
    const it = makeItem(kind, page, 0, 0);
    add({ ...it, x: clamp(px - it.w / 2, 0, 100 - it.w), y: clamp(py - it.h / 2, 0, 100 - it.h) });
    setActivePage(page);
  };

  // ── ลาก / ย่อขยาย / เส้นนำแนว ──
  const onItemDown = (e: React.MouseEvent, it: DocItem, mode: 'move' | 'resize') => {
    if (e.button !== 0 || editing === it.id) return;
    e.stopPropagation();
    setActivePage(it.page);
    let ids = sel;
    if (e.shiftKey && mode === 'move') { ids = sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id]; setSel(ids); return; }
    if (!sel.includes(it.id)) { ids = [it.id]; setSel(ids); }
    if (noMove(it)) return;
    const el = (e.currentTarget as HTMLElement).closest('[data-item]') as HTMLElement | null;
    const box = (el ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    const origin: Drag['origin'] = {};
    for (const x of itemsRef.current) if (ids.includes(x.id) || x.id === it.id) origin[x.id] = { x: x.x, y: x.y, w: x.w, h: x.h, page: x.page };
    drag.current = { mode, id: it.id, sx: e.clientX, sy: e.clientY, grabDx: e.clientX - box.left, grabDy: e.clientY - box.top, origin, start: itemsRef.current };
  };

  const onMove = useCallback((e: MouseEvent) => {
    const d = drag.current; if (!d) return;
    const o = d.origin[d.id];
    const pageBox = pageRefs.current[o.page]?.getBoundingClientRect(); if (!pageBox) return;
    const dx = ((e.clientX - d.sx) / pageBox.width) * 100, dy = ((e.clientY - d.sy) / pageBox.height) * 100;
    const arr = itemsRef.current;

    if (d.mode === 'resize') {
      set(arr.map((it) => (it.id === d.id ? { ...it, w: clamp(o.w + dx, 1.5, 100 - o.x), h: clamp(o.h + dy, 0.8, 100 - o.y) } : it)), false);
      return;
    }
    const ids = Object.keys(d.origin);
    if (ids.length > 1) { // หลายชิ้น — เลื่อนพร้อมกันในหน้าเดิม
      set(arr.map((it) => {
        const s = d.origin[it.id]; if (!s || it.locked || (!canMoveOthers && it.type === 'signature' && it.props?.ownerId && it.props.ownerId !== meId)) return it;
        return { ...it, x: clamp(s.x + dx, 0, 100 - it.w), y: clamp(s.y + dy, 0, 100 - it.h) };
      }), false);
      return;
    }
    // ชิ้นเดียว — ลากข้ามหน้าได้ + ดูดเข้าแนวขอบ/กึ่งกลางหน้าและชิ้นอื่น
    let tp = o.page, box: DOMRect | undefined;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const b = pageRefs.current[i]?.getBoundingClientRect();
      if (b && e.clientY >= b.top && e.clientY <= b.bottom) { tp = i; box = b; break; }
    }
    box = box ?? pageBox;
    let nx = clamp(((e.clientX - d.grabDx - box.left) / box.width) * 100, 0, 100 - o.w);
    let ny = clamp(((e.clientY - d.grabDy - box.top) / box.height) * 100, 0, 100 - o.h);
    const others = arr.filter((x) => x.page === tp && x.id !== d.id);
    const vx = [0, 50, 100, ...others.flatMap((x) => [x.x, x.x + x.w / 2, x.x + x.w])];
    const hy = [0, 50, 100, ...others.flatMap((x) => [x.y, x.y + x.h / 2, x.y + x.h])];
    const snap = (pos: number, size: number, lines: number[]) => {
      let best: { d: number; to: number; line: number } | null = null;
      for (const off of [0, size / 2, size]) for (const l of lines) {
        const dd = Math.abs(pos + off - l);
        if (dd < SNAP && (!best || dd < best.d)) best = { d: dd, to: l - off, line: l };
      }
      return best;
    };
    const sx = snap(nx, o.w, vx), sy = snap(ny, o.h, hy);
    if (sx) nx = sx.to;
    if (sy) ny = sy.to;
    setGuides(sx || sy ? { page: tp, xs: sx ? [sx.line] : [], ys: sy ? [sy.line] : [] } : null);
    set(arr.map((it) => (it.id === d.id ? { ...it, page: tp, x: nx, y: ny } : it)), false);
  }, [set, meId, canMoveOthers]);

  const onUp = useCallback(() => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    setGuides(null);
    if (itemsRef.current !== d.start) history.checkpoint(d.start);
  }, [history]);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onMove, onUp]);

  // ── คำสั่งกับชิ้นที่เลือก ──
  const removeSel = () => { set((arr) => arr.filter((x) => !sel.includes(x.id) || noEdit(x))); setSel([]); };
  const duplicateSel = () => {
    const copies = selected.filter((x) => !foreign(x)).map((x) => ({ ...x, id: newId(x.type), x: clamp(x.x + 2, 0, 100 - x.w), y: clamp(x.y + 2, 0, 100 - x.h), locked: false, z: Date.now() % 1e9 }));
    set((arr) => [...arr, ...copies]); setSel(copies.map((c) => c.id));
  };
  const align = (how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => {
    const s = selected; if (s.length < 2) return;
    const L = Math.min(...s.map((i) => i.x)), R = Math.max(...s.map((i) => i.x + i.w));
    const T = Math.min(...s.map((i) => i.y)), B = Math.max(...s.map((i) => i.y + i.h));
    set((arr) => arr.map((x) => {
      if (!sel.includes(x.id) || noMove(x)) return x;
      if (how === 'l') return { ...x, x: L };
      if (how === 'r') return { ...x, x: R - x.w };
      if (how === 'c') return { ...x, x: (L + R) / 2 - x.w / 2 };
      if (how === 't') return { ...x, y: T };
      if (how === 'b') return { ...x, y: B - x.h };
      return { ...x, y: (T + B) / 2 - x.h / 2 };
    }));
  };

  // ── คีย์ลัด ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); history.redo(); return; }
      if (!sel.length) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
      if (e.key === 'Escape') { setSel([]); return; }
      const step = e.shiftKey ? 2 : 0.25;
      const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (mv[e.key]) {
        e.preventDefault();
        const [ddx, ddy] = mv[e.key];
        set((arr) => arr.map((x) => (sel.includes(x.id) && !noMove(x) ? { ...x, x: clamp(x.x + ddx, 0, 100 - x.w), y: clamp(x.y + ddy, 0, 100 - x.h) } : x)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-full flex-col bg-gray-100">
      {/* แถบเครื่องมือ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
        {header}
        {!readOnly && (
          <div className="mx-1 flex items-center gap-0.5 border-l border-gray-200 pl-2">
            <ToolBtn title="ย้อนกลับ (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo}><Undo2 className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="ทำซ้ำ (Ctrl+Y)" disabled={!history.canRedo} onClick={history.redo}><Redo2 className="h-4 w-4" /></ToolBtn>
          </div>
        )}
        <div className="flex items-center gap-0.5 border-l border-gray-200 pl-2">
          <ToolBtn title="ย่อ" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}><ZoomOut className="h-4 w-4" /></ToolBtn>
          <span className="w-12 text-center text-xs tabular-nums text-gray-600">{Math.round(zoom * 100)}%</span>
          <ToolBtn title="ขยาย" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}><ZoomIn className="h-4 w-4" /></ToolBtn>
        </div>
        {onUploadDocument && !readOnly && (
          <button onClick={() => docInput.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Upload className="h-4 w-4" />{uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดเอกสาร'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* แผงชิ้นส่วน */}
        <aside className={cn('hidden w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-3', !readOnly && 'lg:block')}>
          {ticketTools && (
            <PaletteGroup title="ตราสารบรรณ">
              <PaletteBtn kind="stampMain" icon={Stamp} label="ตราเลขรับหลัก" onAdd={() => addKind('stampMain')} />
              <PaletteBtn kind="stampDept" icon={Stamp} label="ตราเลขรับกอง" onAdd={() => addKind('stampDept')} />
              <PaletteBtn kind="checklist" icon={ListChecks} label="กองที่เกี่ยวข้อง" onAdd={() => addKind('checklist')} />
            </PaletteGroup>
          )}
          <PaletteGroup title="ข้อความ">
            <PaletteBtn kind="text" icon={Type} label="ข้อความ" onAdd={() => addKind('text')} />
            <PaletteBtn kind="heading" icon={Heading} label="หัวข้อ (ตัวใหญ่)" onAdd={() => addKind('heading')} />
          </PaletteGroup>
          <PaletteGroup title="ลายเซ็น">
            <PaletteBtn kind="signature" icon={PenLine} label="ลายเซ็นของฉัน" onAdd={() => addMySig()} />
            {!mySig && <p className="px-2.5 text-[11px] leading-relaxed text-gray-400">ยังไม่มีลายเซ็นที่บันทึกไว้ — กดเพื่อเซ็นครั้งแรก</p>}
          </PaletteGroup>
          <PaletteGroup title="อื่น ๆ">
            <PaletteBtn kind="checkbox" icon={CheckSquare} label="ช่องติ๊ก" onAdd={() => addKind('checkbox')} />
            <PaletteBtn kind="line" icon={Minus} label="เส้น" onAdd={() => addKind('line')} />
            <PaletteBtn kind="rect" icon={Square} label="กรอบ" onAdd={() => addKind('rect')} />
            <PaletteBtn kind="image" icon={ImagePlus} label="รูปภาพ" onAdd={() => { setImgTarget(null); fileInput.current?.click(); }} />
          </PaletteGroup>
        </aside>

        {/* หน้าเอกสาร */}
        <div className="min-w-0 flex-1 overflow-auto p-6" onMouseDown={() => { setSel([]); setEditing(null); }}>
          <div ref={canvasRef} className="mx-auto space-y-8" style={{ width: A4W, zoom }}>
            {pages.map((pg, idx) => {
              const bg = pg.src === 'attachment' ? attachmentImages[pg.srcPage ?? idx] : null;
              const pageItems = items.filter((it) => it.page === idx).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
              return (
                <div key={idx} className="relative">
                  <div className="absolute -left-14 top-1 w-12 text-right text-xs text-gray-400">หน้า {idx + 1}</div>
                  <div ref={(el) => { pageRefs.current[idx] = el; }}
                    onMouseDown={(e) => { e.stopPropagation(); setActivePage(idx); setSel([]); setEditing(null); }}
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-doc-kind')) e.preventDefault(); }}
                    onDrop={(e) => onDropPage(e, idx)}
                    className={cn('relative isolate bg-white shadow-sm', activePage === idx ? 'outline outline-2 outline-offset-4 outline-blue-200' : 'outline outline-1 outline-gray-300')}
                    style={{ width: A4W, height: A4H }}>
                    {bg
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={bg} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" />
                      : !pageItems.length && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">{pg.src === 'blank' ? 'หน้าเปล่า (A4) — ลากชิ้นส่วนจากแผงซ้ายมาวาง' : 'กำลังโหลดหน้าเอกสาร...'}</div>}

                    <div data-export-layer={idx} style={{ position: 'absolute', inset: 0 }}>
                      {pageItems.map((it) => {
                        const isSel = sel.includes(it.id);
                        return (
                          <div key={it.id} data-item={it.id}
                            onMouseDown={(e) => onItemDown(e, it, 'move')}
                            onDoubleClick={(e) => { if (it.type === 'text' && !noEdit(it)) { e.stopPropagation(); setEditing(it.id); setSel([it.id]); } }}
                            className={cn('select-none', noMove(it) ? 'cursor-default' : 'cursor-move')}
                            style={{ position: 'absolute', left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, height: `${it.h}%`, zIndex: it.z ?? 0 }}>
                            {editing === it.id
                              ? <InlineText it={it} onDone={(text) => { patchProps(it.id, { text }); setEditing(null); }} />
                              : <ItemContent it={it} ctx={ctx} />}
                            {isSel && <div data-editor-only className={cn('pointer-events-none absolute -inset-[3px] border-2', noMove(it) ? 'border-gray-400 border-dashed' : 'border-blue-500')} />}
                            {isSel && sel.length === 1 && !noMove(it) && editing !== it.id && (
                              <span data-editor-only onMouseDown={(e) => onItemDown(e, it, 'resize')}
                                className="absolute -bottom-2 -right-2 h-3.5 w-3.5 cursor-se-resize rounded-full border-2 border-white bg-blue-600 shadow" />
                            )}
                          </div>
                        );
                      })}
                      {guides?.page === idx && (<>
                        {guides.xs.map((x) => <div key={`x${x}`} data-editor-only className="pointer-events-none absolute inset-y-0 w-px bg-rose-500" style={{ left: `${x}%` }} />)}
                        {guides.ys.map((y) => <div key={`y${y}`} data-editor-only className="pointer-events-none absolute inset-x-0 h-px bg-rose-500" style={{ top: `${y}%` }} />)}
                      </>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* แผงคุณสมบัติ */}
        <aside className={cn('hidden w-64 shrink-0 overflow-y-auto border-l border-gray-200 bg-white', !readOnly && 'lg:block')} onMouseDown={(e) => e.stopPropagation()}>
          {selected.length === 0 && <EmptyInspector canUpload={!!onUploadDocument} />}
          {selected.length > 1 && (
            <InspectorSection title={`เลือก ${selected.length} ชิ้น`}>
              <p className="mb-2 text-xs text-gray-500">จัดแนว</p>
              <div className="grid grid-cols-6 gap-1">
                <ToolBtn title="ชิดซ้าย" onClick={() => align('l')}><AlignStartVertical className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="กึ่งกลางแนวนอน" onClick={() => align('c')}><AlignCenterVertical className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="ชิดขวา" onClick={() => align('r')}><AlignEndVertical className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="ชิดบน" onClick={() => align('t')}><AlignStartHorizontal className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="กึ่งกลางแนวตั้ง" onClick={() => align('m')}><AlignCenterHorizontal className="h-4 w-4" /></ToolBtn>
                <ToolBtn title="ชิดล่าง" onClick={() => align('b')}><AlignEndHorizontal className="h-4 w-4" /></ToolBtn>
              </div>
              <div className="mt-3 flex gap-2">
                <SmallBtn onClick={duplicateSel}><Copy className="h-3.5 w-3.5" />ทำสำเนา</SmallBtn>
                <SmallBtn danger onClick={removeSel}><Trash2 className="h-3.5 w-3.5" />ลบ</SmallBtn>
              </div>
            </InspectorSection>
          )}
          {one && (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-900">{TYPE_LABEL[one.type]}</span>
                {!foreign(one) && (
                  <div className="flex items-center gap-0.5">
                    {one.type !== 'signature' && <ToolBtn title="ทำสำเนา (Ctrl+D)" onClick={duplicateSel}><Copy className="h-4 w-4" /></ToolBtn>}
                    <ToolBtn title="ลบ (Delete)" onClick={removeSel}><Trash2 className="h-4 w-4 text-red-500" /></ToolBtn>
                  </div>
                )}
              </div>
              {foreign(one) ? (
                <InspectorSection>
                  <p className="flex items-start gap-2 text-sm leading-relaxed text-gray-600">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    {canMoveOthers
                      ? <>ลายเซ็นของ {one.props.name || 'ผู้อื่น'} — ลากย้าย/ย่อขยายเพื่อจัดวางได้ แต่ลบหรือแก้ไม่ได้</>
                      : <>ลายเซ็นของ {one.props.name || 'ผู้อื่น'} — ย้าย แก้ไข หรือลบได้เฉพาะเจ้าของลายเซ็น</>}
                  </p>
                </InspectorSection>
              ) : (
                <ItemInspector it={one} ctx={ctx} onProps={(p) => patchProps(one.id, p)}
                  onReplaceImage={() => { setImgTarget(one.id); fileInput.current?.click(); }} />
              )}
            </>
          )}
        </aside>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickImage} />
      <input ref={docInput} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={onPickDoc} />

      {sigModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={() => setSigModal(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">ลายเซ็นของฉัน</h3>
            <p className="mb-3 mt-1 text-xs text-gray-500">เซ็นครั้งเดียว ระบบจะเก็บไว้ในเมนู &quot;จัดการลายเซ็น&quot; ครั้งต่อไปกดวางได้เลย</p>
            <SignatureDrawer onSave={saveFirstSig} onCancel={() => setSigModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** แก้ข้อความในหน้าโดยตรง (ดับเบิลคลิก) — แสดงข้อความดิบรวม {{ช่องอัตโนมัติ}} */
function InlineText({ it, onDone }: { it: DocItem; onDone: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.innerText = it.props.text ?? '';
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.currentTarget.innerText.replace(/\n$/, ''))}
      onKeyDown={(e) => { if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur(); }}
      style={{ ...textStyle(it.props), outline: 'none', cursor: 'text', background: 'rgba(219,234,254,0.35)', overflow: 'visible' }} />
  );
}

function ItemInspector({ it, ctx, onProps, onReplaceImage }: {
  it: DocItem; ctx: DocContext; onProps: (p: Record<string, any>) => void; onReplaceImage: () => void;
}) {
  const p = it.props || {};
  const textControls = (
    <>
      <Field label="ขนาดตัวอักษร">
        <select value={pxToPt(p.size || 21)} onChange={(e) => onProps({ size: ptToPx(Number(e.target.value)) })} className={inputCls}>
          {[...new Set([...PT_SIZES, pxToPt(p.size || 21)])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s} pt</option>)}
        </select>
      </Field>
      <Field label="สี"><Swatches value={p.color} onChange={(color) => onProps({ color })} /></Field>
    </>
  );
  switch (it.type) {
    case 'text':
      return (
        <InspectorSection>
          <Field label="ข้อความ">
            <textarea value={p.text ?? ''} onChange={(e) => onProps({ text: e.target.value })} rows={4} className={cn(inputCls, 'resize-y')} />
          </Field>
          <FieldAdder onPick={(k) => onProps({ text: `${p.text ?? ''}{{${k}}}` })} />
          {textControls}
          <Field label="รูปแบบ">
            <div className="flex gap-1">
              <Toggle on={!!p.bold} title="ตัวหนา" onClick={() => onProps({ bold: !p.bold })}><Bold className="h-4 w-4" /></Toggle>
              <Toggle on={!!p.italic} title="ตัวเอียง" onClick={() => onProps({ italic: !p.italic })}><Italic className="h-4 w-4" /></Toggle>
              <Toggle on={!!p.underline} title="ขีดเส้นใต้" onClick={() => onProps({ underline: !p.underline })}><Underline className="h-4 w-4" /></Toggle>
              <span className="mx-1 w-px bg-gray-200" />
              <Toggle on={(p.align || 'left') === 'left'} title="ชิดซ้าย" onClick={() => onProps({ align: 'left' })}><AlignLeft className="h-4 w-4" /></Toggle>
              <Toggle on={p.align === 'center'} title="กึ่งกลาง" onClick={() => onProps({ align: 'center' })}><AlignCenter className="h-4 w-4" /></Toggle>
              <Toggle on={p.align === 'right'} title="ชิดขวา" onClick={() => onProps({ align: 'right' })}><AlignRight className="h-4 w-4" /></Toggle>
            </div>
          </Field>
        </InspectorSection>
      );
    case 'checkbox':
      return (
        <InspectorSection>
          <Field label="ข้อความ"><input value={p.label ?? ''} onChange={(e) => onProps({ label: e.target.value })} className={inputCls} /></Field>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!p.checked} onChange={(e) => onProps({ checked: e.target.checked })} className="h-4 w-4" /> ติ๊กถูก
          </label>
          {textControls}
        </InspectorSection>
      );
    case 'line':
    case 'rect':
      return (
        <InspectorSection>
          <Field label="สีเส้น"><Swatches value={p.color} onChange={(color) => onProps({ color })} /></Field>
          <Field label="ความหนา">
            <select value={p.thickness ?? 1.5} onChange={(e) => onProps({ thickness: Number(e.target.value) })} className={inputCls}>
              {[1, 1.5, 2, 3, 4].map((t) => <option key={t} value={t}>{t} px</option>)}
            </select>
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!p.dashed} onChange={(e) => onProps({ dashed: e.target.checked })} className="h-4 w-4" /> เส้นประ
          </label>
          {it.type === 'rect' && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!p.fill} onChange={(e) => onProps({ fill: e.target.checked ? '#f3f4f6' : '' })} className="h-4 w-4" /> พื้นสีเทาอ่อน
            </label>
          )}
        </InspectorSection>
      );
    case 'image':
      return <InspectorSection><SmallBtn onClick={onReplaceImage}><ImagePlus className="h-3.5 w-3.5" />เปลี่ยนรูป</SmallBtn></InspectorSection>;
    case 'signature':
      return (
        <InspectorSection>
          <Field label="ชื่อใต้ลายเซ็น"><input value={p.name ?? ''} onChange={(e) => onProps({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="ตำแหน่ง"><input value={p.pos ?? ''} onChange={(e) => onProps({ pos: e.target.value })} className={inputCls} /></Field>
        </InspectorSection>
      );
    case 'stampMain':
    case 'stampDept': {
      const v = stampValues(it, ctx);
      const edited = ['title', 'regNo', 'date', 'time'].some((k) => p[k] !== undefined);
      return (
        <InspectorSection>
          <Field label="หัวตรา"><input value={v.title} onChange={(e) => onProps({ title: e.target.value })} className={inputCls} /></Field>
          <Field label="เลขรับที่"><input value={v.regNo} onChange={(e) => onProps({ regNo: e.target.value })} className={inputCls} /></Field>
          <Field label="วันที่"><input value={v.date} onChange={(e) => onProps({ date: e.target.value })} className={inputCls} /></Field>
          <Field label="เวลา"><input value={v.time} onChange={(e) => onProps({ time: e.target.value })} className={inputCls} /></Field>
          {edited
            ? <SmallBtn onClick={() => onProps({ title: undefined, regNo: undefined, date: undefined, time: undefined })}>ใช้ข้อมูลจากเรื่องตามเดิม</SmallBtn>
            : <p className="text-xs text-gray-500">ข้อมูลดึงจากเรื่องให้อัตโนมัติ แก้ได้ทุกช่อง</p>}
        </InspectorSection>
      );
    }
    case 'checklist': {
      const rows = checklistRows(it, ctx);
      const setRows = (next: { name: string; checked: boolean }[]) => onProps({ depts: next });
      const unused = (ctx.allDepts || []).filter((d) => !rows.some((r) => r.name === d.nameTh));
      return (
        <InspectorSection>
          <p className="mb-2 text-xs font-medium text-gray-600">รายการกอง (ติ๊ก = ทำเครื่องหมายถูก)</p>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input type="checkbox" checked={r.checked} aria-label="ติ๊ก"
                  onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, checked: e.target.checked } : x)))} className="h-4 w-4 shrink-0" />
                <input value={r.name} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={inputCls} />
                <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))} title="เอาออก" aria-label="เอาออก"
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <select value="" className={cn(inputCls, 'mt-2.5')}
            onChange={(e) => { const v = e.target.value; if (v === '__new') setRows([...rows, { name: '', checked: true }]); else if (v) setRows([...rows, { name: v, checked: true }]); }}>
            <option value="">+ เพิ่มกอง...</option>
            {unused.map((d) => <option key={d.id} value={d.nameTh}>{d.nameTh}</option>)}
            <option value="__new">พิมพ์ชื่อเอง</option>
          </select>
          {p.depts && <div className="mt-3"><SmallBtn onClick={() => onProps({ depts: undefined })}>ใช้กองจากเรื่องตามเดิม</SmallBtn></div>}
        </InspectorSection>
      );
    }
    default:
      return null;
  }
}

function EmptyInspector({ canUpload }: { canUpload?: boolean }) {
  return (
    <InspectorSection title="วิธีใช้">
      <ol className="space-y-2.5 text-sm leading-relaxed text-gray-600">
        {canUpload && <li>• กด &quot;อัปโหลดเอกสาร&quot; (แถบบน) ถ้าต้องการเปลี่ยนเป็นไฟล์อื่น (PDF หรือรูป)</li>}
        <li><b className="font-semibold text-gray-800">1.</b> กด &quot;ลายเซ็นของฉัน&quot; (หรือลากไปวาง) แล้วลากไปตำแหน่งที่ต้องการ · ลากจุดมุมขวาล่างเพื่อย่อ/ขยาย</li>
        <li><b className="font-semibold text-gray-800">2.</b> เพิ่มตรา ข้อความ หรือช่องติ๊กได้จากแผงซ้าย · ดับเบิลคลิกข้อความเพื่อพิมพ์</li>
        <li><b className="font-semibold text-gray-800">3.</b> เสร็จแล้วกด &quot;บันทึก&quot; หรือ &quot;ย้อนกลับ&quot; (บันทึกให้อัตโนมัติ)</li>
      </ol>
      <p className="mt-4 text-xs text-gray-400">ทำพลาด กด Ctrl+Z เพื่อย้อนกลับ · กด Delete เพื่อลบชิ้นที่เลือก</p>
    </InspectorSection>
  );
}

// ─────────────────────────────── ชิ้นส่วน UI ย่อย ───────────────────────────────
const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none';

function ToolBtn({ children, title, onClick, disabled }: { children: ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}
function Toggle({ on, children, title, onClick }: { on: boolean; children: ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
      {children}
    </button>
  );
}
function SmallBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm', danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}>
      {children}
    </button>
  );
}
function InspectorSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="px-4 py-4">
      {title && <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>}
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mb-3 block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}
function Swatches({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {INK.map((c) => (
        <button key={c.value} type="button" title={c.label} aria-label={c.label} onClick={() => onChange(c.value)}
          className={cn('h-7 w-7 rounded-full border-2', (value || '#000000') === c.value ? 'border-blue-600' : 'border-white ring-1 ring-gray-200')}
          style={{ background: c.value }} />
      ))}
    </div>
  );
}
function PaletteGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function PaletteBtn({ kind, icon: Icon, label, onAdd }: { kind: string; icon: React.ComponentType<{ className?: string }>; label: string; onAdd: () => void }) {
  return (
    <button type="button" draggable onClick={onAdd}
      onDragStart={(e) => { e.dataTransfer.setData('application/x-doc-kind', kind); e.dataTransfer.effectAllowed = 'copy'; }}
      className="flex w-full cursor-grab items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 active:cursor-grabbing">
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />{label}
    </button>
  );
}
function FieldAdder({ onPick }: { onPick: (key: string) => void }) {
  return (
    <div className="mb-3">
      <select value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }} className={inputCls}>
        <option value="">แทรกข้อมูลจากเรื่อง...</option>
        {FIELD_DEFS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
    </div>
  );
}
