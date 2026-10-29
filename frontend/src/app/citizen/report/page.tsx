'use client';
import { Suspense, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  MessageSquareWarning, CheckCircle2, Send, MapPin, User, Phone, Navigation,
} from 'lucide-react';
import { VoiceTextarea, FilePicker } from '../forms/form-engine';
import { saveMyReport } from '../my-reports';
import { BackLink } from '../cz-ui';

// ศูนย์กลางเริ่มต้นของตำบล (ใช้ตอนยังไม่รู้ตำแหน่ง/ขอ GPS ไม่สำเร็จ) — จุดเดียวกับหน้า GIS มาตรวัดน้ำของเจ้าหน้าที่
const DEFAULT_CENTER: [number, number] = [14.6, 102.6];

// เรื่องทั่วไปเป็นค่าเริ่มต้น (ตัวแรก) — รายละเอียดเฉพาะเจาะจง (ไฟฟ้า/ประปา/ท่อระบายน้ำ/ทุจริต ฯลฯ)
// ให้พิมพ์ในช่องรายละเอียดแทน ไม่ต้องแยกประเภทย่อย
const CATEGORIES = [
  'เรื่องทั่วไป',
  'ขอใช้บริการรถกู้ภัย',
  'ขอใช้บริการรถดับเพลิง',
  'ขอใช้บริการรถส่งผู้ป่วย',
  'ขอใช้บริการรถแจกน้ำ',
  // เรื่องที่ไม่เข้าหมวดไหน — ใช้ฟอร์มแจ้งเรื่องแบบเดิม (รายละเอียด + GPS/ที่อยู่ + ชื่อ/เบอร์ไม่บังคับ)
  'อื่นๆ',
];

/** ต้องตรงกับ DETAIL_MAX ฝั่ง backend (dto/citizen-report.dto.ts) */
const DETAIL_MAX = 2000;

export default function CitizenReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportForm />
    </Suspense>
  );
}

function ReportForm() {
  const params = useSearchParams();
  const cat0 = params.get('cat') || '';
  const initialCat = useMemo(() => CATEGORIES.find((c) => c === cat0) || CATEGORIES[0], [cat0]);

  const [category, setCategory] = useState(initialCat);
  // ขอใช้รถ แยกเป็นบริการของตัวเอง (หน้า /citizen/vehicle เลือกรถจากรูป) — มาจากหน้านั้น = ล็อกประเภทไว้ ไม่โชว์ช่องเลือก
  const lockedVehicle = initialCat.startsWith('ขอใช้บริการ');
  const pickable = CATEGORIES.filter((c) => !c.startsWith('ขอใช้บริการ'));
  const [detail, setDetail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [villageNo, setVillageNo] = useState(''); // กรอกเองในช่อง "หมู่ที่" — ขอใช้บริการกด GPS แล้วเดาเติมให้ (แก้ได้)
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ refNo: string } | null>(null);

  // คำร้องทั่วไป — เอกสารทางการ ลูกบ้านกรอกชื่อ-ที่อยู่-เรื่องเองตั้งแต่ตรงนี้เลย (ไม่ต้องให้ อบต. กรอกย้อนหลัง)
  const isPetition = category === 'เรื่องทั่วไป';
  // ขอใช้บริการ (รถกู้ภัย/ดับเพลิง/ส่งผู้ป่วย/แจกน้ำ) ใช้เอกสารคำร้องแบบเดียวกัน — กรอกข้อมูลผู้ยื่นครบเหมือนกัน
  // ต่างกันแค่ "เรื่อง" ใช้ชื่อบริการให้อัตโนมัติ และยังมี GPS ปักหมุดจุดเกิดเหตุ
  const isService = category.startsWith('ขอใช้บริการ');
  const serviceSubject = `ขอใช้${category.replace('ขอใช้บริการ', '')}`;
  const needsApplicant = isPetition || isService;
  const [subject, setSubject] = useState('');
  const [titlePrefix, setTitlePrefix] = useState('นาย');
  const [houseNo, setHouseNo] = useState('');

  // แผนที่ปักหมุดแบบลาก (คล้าย Grab) — หมุดอยู่กึ่งกลางคงที่ ลากแผนที่ข้างใต้แทน
  const [mapOpen, setMapOpen] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // ลากแผนที่แล้วหยุด (ปล่อยนิ้ว/ปล่อยเมาส์) → บันทึกจุดกึ่งกลางให้อัตโนมัติเลย ไม่ต้องกดยืนยัน
  // พิกัดเก็บแยก (geoLat/geoLng) ไม่เขียนลงช่องที่อยู่ — ไม่งั้นเลขพิกัดไปโผล่ในเอกสารคำร้อง
  // ประชาชนเห็นจุดที่ปักจากแผนที่ย่อใต้ช่อง · เจ้าหน้าที่เห็นลิงก์แผนที่ฝั่ง admin (ดู citizen-reports/page.tsx)
  const saveCenter = async (lat: number, lng: number) => {
    const la = +lat.toFixed(6), ln = +lng.toFixed(6);
    setGeo({ lat: la, lng: ln });
    try {
      const { data } = await api.get('/citizen/report/nearest-village', { params: { lat: la, lng: ln } });
      if (data.data.villageNo) setVillageNo(String(data.data.villageNo));
    } catch { /* เดาไม่ได้ก็ไม่เป็นไร ยังมีพิกัดอยู่ดี */ }
  };

  const openMap = () => {
    setMapOpen(true);
    setGpsBusy(true);
    const start = (center: [number, number]) => {
      setGpsBusy(false);
      // สร้างแผนที่หลัง div เรนเดอร์แล้ว (mapOpen เปลี่ยนเป็น true ก่อนหน้านี้ 1 tick)
      requestAnimationFrame(async () => {
        if (!mapEl.current) return;
        const L = (await import('leaflet')).default;
        if (mapRef.current) mapRef.current.remove();
        const map = L.map(mapEl.current, { preferCanvas: true }).setView(center, 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        mapRef.current = map;
        // ขนาด container อาจยังคำนวณไม่นิ่งตอนเพิ่งโผล่ (โดยเฉพาะมือถือ) — บังคับคำนวณใหม่กันแผนที่เพี้ยน/ลากไม่ลื่น
        setTimeout(() => map.invalidateSize(), 150);
        // หยุดลาก/ซูมเมื่อไหร่ก็บันทึกจุดกึ่งกลางทันที (จุดเริ่มต้นก็บันทึกไว้ก่อนเลยด้วย)
        map.on('moveend', () => { const c = map.getCenter(); saveCenter(c.lat, c.lng); });
        saveCenter(center[0], center[1]);
      });
    };
    const fallback: [number, number] = geo ? [geo.lat, geo.lng] : DEFAULT_CENTER;
    if (!navigator.geolocation) { start(fallback); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => start([pos.coords.latitude, pos.coords.longitude]),
      () => start(fallback),
      { enableHighAccuracy: true, timeout: 10000 },
    );                                          
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (detail.trim().length < 5) { toast.error(isPetition ? 'กรุณากรอกความประสงค์อย่างน้อย 5 ตัวอักษร' : 'กรุณากรอกรายละเอียดอย่างน้อย 5 ตัวอักษร'); return; }
    if (needsApplicant) {
      if (isPetition && !subject.trim()) { toast.error('กรุณากรอกเรื่อง'); return; }
      if (!name.trim()) { toast.error('กรุณากรอกชื่อ-สกุลผู้ยื่นคำร้อง'); return; }
      if (!houseNo.trim()) { toast.error('กรุณากรอกบ้านเลขที่'); return; }
      if (!villageNo.trim()) { toast.error('กรุณากรอกหมู่ที่'); return; }
      if (!phone.trim()) { toast.error('กรุณากรอกเบอร์โทรศัพท์'); return; }
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('detail', detail.trim());
      if (name.trim()) fd.append('reporterName', name.trim());
      if (phone.trim()) fd.append('reporterPhone', phone.trim());
      if (location.trim()) fd.append('location', location.trim());
      if (villageNo) fd.append('villageNo', villageNo);
      if (geo) { fd.append('geoLat', String(geo.lat)); fd.append('geoLng', String(geo.lng)); }
      if (photo) fd.append('photo', photo);
      if (needsApplicant) {
        fd.append('subject', isPetition ? subject.trim() : category);
        fd.append('titlePrefix', titlePrefix);
        if (houseNo.trim()) fd.append('houseNo', houseNo.trim());
      }
      const { data } = await api.post('/citizen/report', fd);
      // จำไว้ในเครื่องนี้อัตโนมัติ — ผู้แจ้งไม่ต้องจำ/จดเลขอ้างอิงเอง กลับมาดูที่หน้าติดตามสถานะได้เลย
      saveMyReport({ refNo: data.data.refNo, phone: phone.trim(), title: category, at: new Date().toISOString() });
      setDone({ refNo: data.data.refNo });
    } catch (err) {
      toast.error(getErrorMessage(err, 'ส่งเรื่องไม่สำเร็จ'));
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="cz-anim-in mx-auto max-w-lg">
        <div className="cz-anim-scale rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">ส่งเรื่องสำเร็จแล้ว</h2>
          <p className="mt-1 text-slate-500">ขอบคุณที่แจ้งเข้ามา เจ้าหน้าที่จะตรวจสอบและดำเนินการต่อไป</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/citizen/track" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">ติดตามสถานะ</Link>
            <button onClick={() => { setDone(null); setDetail(''); setPhoto(null); setVillageNo(''); setGeo(null); setLocation(''); setSubject(''); setHouseNo(''); setName(''); setPhone(''); }}
              className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">แจ้งเรื่องใหม่</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cz-anim-in mx-auto max-w-lg">
      <BackLink href={lockedVehicle ? '/citizen/vehicle' : '/citizen'}>{lockedVehicle ? 'เลือกรถประเภทอื่น' : 'กลับหน้าบริการ'}</BackLink>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-sm">
          <MessageSquareWarning className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{lockedVehicle ? `ขอใช้${category.replace('ขอใช้บริการ', '')}` : 'แจ้งเรื่อง / ร้องเรียน'}</h1>
          <p className="text-xs text-slate-400">{lockedVehicle ? 'กรอกข้อมูลผู้ขอและปักหมุดจุดที่ให้รถไป' : 'แจ้งเหตุถึง อบต. โดยตรง · เก็บเลขอ้างอิงไว้เช็กสถานะได้'}</p>
        </div>
      </div>

      <form onSubmit={submit} className="cz-anim-up space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        {!lockedVehicle && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">ประเภทเรื่อง <span className="text-rose-500">*</span></span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              {pickable.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {(isPetition || isService) && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">เรื่อง <span className="text-rose-500">*</span></span>
            {isPetition ? (
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="เช่น ขอความอนุเคราะห์ซ่อมไฟฟ้าส่องสว่าง" className={field} />
            ) : (
              // ขอใช้รถ: ชื่อเรื่องคือรถที่เลือกจากหน้า /citizen/vehicle ล็อกไว้ ไม่ให้แก้
              <input value={serviceSubject} readOnly className={`${field} bg-slate-50 text-slate-600`} />
            )}
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-600">
            {isPetition ? 'ความประสงค์ของท่าน' : 'รายละเอียด'} <span className="text-rose-500">*</span>
          </span>
          <VoiceTextarea label="รายละเอียด" value={detail} onChange={(v) => setDetail(v.slice(0, DETAIL_MAX))}
            placeholder={isPetition ? 'อธิบายว่าต้องการให้ อบต. ช่วยเหลือ/ดำเนินการอะไร' : 'อธิบายเหตุการณ์/ปัญหาที่พบ ให้ชัดเจน'}
            className={`${field} resize-none`} />
          <span className={`mt-1 block text-right text-xs ${detail.length >= DETAIL_MAX ? 'text-rose-500' : 'text-slate-400'}`}>
            {detail.length.toLocaleString()}/{DETAIL_MAX.toLocaleString()} ตัวอักษร
          </span>
        </label>

        {!isPetition && (
          <>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-600"><MapPin className="h-3.5 w-3.5" /> จุดเกิดเหตุ / ที่อยู่</span>
              <div className="flex gap-2">
                <input value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder={geo ? 'ปักหมุดแล้ว · พิมพ์จุดสังเกตเพิ่มได้' : 'พิมพ์ที่อยู่ หรือกด GPS'} className={`${field} flex-1`} />
                <button type="button" onClick={openMap} disabled={gpsBusy}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                  <Navigation className={`h-4 w-4 ${gpsBusy ? 'animate-pulse' : ''}`} /> GPS
                </button>
              </div>

              {/* แผนที่ปักหมุด — ลากแผนที่ข้างใต้ หมุดอยู่กึ่งกลางคงที่เสมอ (แบบ Grab) หยุดลากเมื่อไหร่บันทึกอัตโนมัติทันที ไม่ต้องกดยืนยัน */}
              {mapOpen && (
                <div className="relative isolate mt-2 h-64 w-full touch-none overflow-hidden rounded-xl border border-cyan-200 bg-slate-100">
                  <div ref={mapEl} className="h-full w-full" />
                  <MapPin className="pointer-events-none absolute left-1/2 top-1/2 z-1000 h-10 w-10 -translate-x-1/2 -translate-y-full fill-rose-500 text-rose-600 drop-shadow-lg" />
                </div>
              )}

              {!mapOpen && geo && (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
                  <iframe title="แผนที่ตำแหน่ง" loading="lazy" className="h-32 w-full bg-slate-50"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.lng - 0.004}%2C${geo.lat - 0.0025}%2C${geo.lng + 0.004}%2C${geo.lat + 0.0025}&layer=mapnik&marker=${geo.lat}%2C${geo.lng}`} />
                </div>
              )}
            </label>

          </>
        )}

        {needsApplicant ? (
          <>
            {/* ข้อมูลผู้ยื่นคำร้อง — ใช้พิมพ์ในเอกสารคำร้องทั่วไปโดยตรง เลยกรอกให้ครบตั้งแต่ตรงนี้ */}
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">คำนำหน้า</span>
                <select value={titlePrefix} onChange={(e) => setTitlePrefix(e.target.value)} className={field}>
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                </select>
              </label>
              <label className="col-span-2 block">
                <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-600"><User className="h-3.5 w-3.5" /> ชื่อ-สกุล <span className="text-rose-500">*</span></span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" className={field} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">บ้านเลขที่ <span className="text-rose-500">*</span></span>
                <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="เช่น 88/9" className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">หมู่ที่ <span className="text-rose-500">*</span></span>
                <input value={villageNo} onChange={(e) => setVillageNo(e.target.value)} inputMode="numeric" placeholder="เช่น 5" className={field} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-600"><Phone className="h-3.5 w-3.5" /> เบอร์โทรศัพท์ <span className="text-rose-500">*</span></span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="เช่น 0891234567" className={field} />
            </label>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-600"><User className="h-3.5 w-3.5" /> ชื่อผู้แจ้ง</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ไม่บังคับ" className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-600"><Phone className="h-3.5 w-3.5" /> เบอร์ติดต่อกลับ</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="ไว้เช็กสถานะ/ติดต่อกลับ" className={field} />
              </label>
            </div>

          </>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600">{isPetition ? 'แนบเอกสารประกอบ' : 'แนบรูป'} <span className="text-slate-400">(ไม่บังคับ)</span></span>
          <FilePicker file={photo || undefined} onFile={setPhoto} />
        </div>

        <button type="submit" disabled={loading || detail.trim().length < 5 || (needsApplicant && ((isPetition && !subject.trim()) || !name.trim() || !houseNo.trim() || !villageNo.trim() || !phone.trim()))}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50">
          {loading ? 'กำลังส่ง…' : 'ส่งเรื่อง'} <Send className="h-4 w-4" />
        </button>
        <p className="text-center text-xs text-slate-400">ข้อมูลนี้ส่งถึงเจ้าหน้าที่ อบต. โดยตรง</p>
      </form>
    </div>
  );
}
