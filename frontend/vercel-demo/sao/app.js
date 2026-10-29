/* หน้าค่าแผงตลาดและค่าเก็บขยะบ้านของ SAO (เดโม่) — ทำงานกับข้อมูลจำลองในเบราว์เซอร์ (localStorage) */
(function () {
  var KEY = 'sao-demo:v1';
  var app = document.getElementById('saoApp');
  if (!app) return;
  var MODE = app.getAttribute('data-sao-page');
  var SEED = window.SAO_DEMO_SEED;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fresh() { return { v: 1, stalls: clone(SEED.stalls), bills: clone(SEED.bills), waste: clone(SEED.waste) }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) { /* ใช้ข้อมูลตั้งต้น */ }
    return fresh();
  }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* เก็บไม่ได้ก็ยังใช้ได้ในหน้านี้ */ } }

  var STATUS = { available: 'ว่าง', reserved: 'จอง', occupied: 'มีผู้เช่า' };
  var TONE = {
    available: 'background:#fff;border:1px solid #cbd5e1;color:#475569',
    reserved: 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e',
    occupied: 'background:#e0f2fe;border:1px solid #7dd3fc;color:#075985'
  };
  var BILL = { unpaid: 'ค้างชำระ', pending: 'รอตรวจสลิป', paid: 'ชำระแล้ว', mismatch: 'ยอดไม่ตรง' };
  var METHOD = { cash: 'เงินสด', qr: 'สแกนจ่าย', transfer: 'โอน' };
  var KIND = { rent: 'ค่าเช่าแผง', waste: 'ค่าขยะแผง' };
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var BTN = 'display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:6px 12px;font:600 13px sans-serif;cursor:pointer;background:#0b6b4f;color:#fff;border:0';
  var BTN2 = 'display:inline-flex;align-items:center;border-radius:8px;padding:6px 12px;font:600 13px sans-serif;cursor:pointer;background:#fff;color:#334155;border:1px solid #cbd5e1';
  var INP = 'border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px;font:14px sans-serif;background:#fff';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return Number(n || 0).toLocaleString('th-TH'); }
  function plabel(p) { var x = String(p).split('-'); return (MONTHS[Number(x[1]) - 1] || x[1]) + ' ' + x[0]; }
  function receiptNo(prefix, period) { return prefix + '-' + period + '-' + Date.now().toString(36).toUpperCase(); }
  function toast(msg) {
    var t = document.getElementById('saoToast');
    if (!t) { t = document.createElement('div'); t.id = 'saoToast'; t.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);background:#0f2a44;color:#fff;padding:10px 16px;border-radius:12px;font:14px sans-serif;z-index:9998;max-width:90vw'; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast.tm); toast.tm = setTimeout(function () { t.style.display = 'none'; }, 2200);
  }

  var view = 'plan', billStatus = '', editing = null, method = {}, wq = '', wresults = null;

  // ───── ค่าแผงตลาด ─────
  function marketHTML() {
    var c = { available: 0, reserved: 0, occupied: 0 };
    S.stalls.forEach(function (s) { c[s.status]++; });
    var head = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px">' +
      '<div style="display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#fff">' +
      '<button data-act="view" data-v="plan" style="' + (view === 'plan' ? BTN : BTN2) + ';border-radius:0;border:0">ผังแผง</button>' +
      '<button data-act="view" data-v="bills" style="' + (view === 'bills' ? BTN : BTN2) + ';border-radius:0;border:0">บิลค่าแผง</button></div>' +
      '<span style="margin-left:auto;color:#64748b;font:14px sans-serif">ว่าง ' + c.available + ' · จอง ' + c.reserved + ' · มีผู้เช่า ' + c.occupied + '</span>' +
      '<button data-act="reset" style="' + BTN2 + '">รีเซ็ตข้อมูลตัวอย่าง</button></div>';
    if (view === 'plan') {
      var zones = {};
      S.stalls.forEach(function (s) { (zones[s.zone] = zones[s.zone] || []).push(s); });
      var body = '';
      if (editing) body += editorHTML(editing);
      Object.keys(zones).sort().forEach(function (z) {
        body += '<section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px"><h2 style="font:600 15px sans-serif;margin:0 0 12px">แถว ' + z + '</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">' +
          zones[z].map(function (s) {
            return '<button data-act="edit" data-id="' + esc(s.id) + '" title="' + esc(s.tenant || '') + '" style="' + TONE[s.status] + ';border-radius:10px;padding:8px;text-align:center;cursor:pointer;font:12px sans-serif">' +
              '<div style="font-weight:700;font-size:14px">' + esc(s.id) + '</div><div>' + STATUS[s.status] + '</div>' +
              '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8">' + esc(s.tenant || '—') + '</div></button>';
          }).join('') + '</div></section>';
      });
      return head + body;
    }
    var rows = S.bills.filter(function (b) { return !billStatus || b.status === billStatus; })
      .sort(function (a, b) { return a.period < b.period ? 1 : a.period > b.period ? -1 : a.stall < b.stall ? -1 : 1; });
    var unpaid = S.bills.filter(function (b) { return b.status !== 'paid'; });
    var sum = unpaid.reduce(function (n, b) { return n + b.amount; }, 0);
    return head +
      '<section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px"><div style="display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid #e2e8f0">' +
      '<select data-act="filter" style="' + INP + '"><option value="">ทุกสถานะ</option>' + Object.keys(BILL).map(function (k) { return '<option value="' + k + '"' + (billStatus === k ? ' selected' : '') + '>' + BILL[k] + '</option>'; }).join('') + '</select>' +
      '<span style="margin-left:auto;color:#64748b;font:14px sans-serif">ยอดยังไม่ชำระ ' + money(sum) + ' บาท (' + unpaid.length + ' ใบ)</span></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font:14px sans-serif"><thead style="background:#f8fafc;text-align:left;color:#475569"><tr>' +
      '<th style="padding:8px 12px">แผง</th><th style="padding:8px 12px">ผู้เช่า</th><th style="padding:8px 12px">รายการ</th><th style="padding:8px 12px">งวด</th><th style="padding:8px 12px;text-align:right">ยอด</th><th style="padding:8px 12px">สถานะ</th><th style="padding:8px 12px">รับชำระ</th></tr></thead><tbody>' +
      rows.map(function (b) {
        var paid = b.status === 'paid';
        return '<tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 12px;font-weight:600">' + esc(b.stall) + '</td><td style="padding:8px 12px">' + esc(b.payer) + '</td><td style="padding:8px 12px">' + KIND[b.kind] + '</td><td style="padding:8px 12px">' + plabel(b.period) + '</td>' +
          '<td style="padding:8px 12px;text-align:right">' + money(b.amount) + '</td>' +
          '<td style="padding:8px 12px">' + BILL[b.status] + (paid ? '<div style="color:#64748b;font-size:12px">' + METHOD[b.method] + ' · ' + esc(b.receipt) + '</div>' : '') + '</td>' +
          '<td style="padding:8px 12px">' + (paid ? '' : '<select data-act="method" data-id="' + b.id + '" style="' + INP + ';padding:4px 6px">' + Object.keys(METHOD).map(function (k) { return '<option value="' + k + '"' + ((method[b.id] || 'cash') === k ? ' selected' : '') + '>' + METHOD[k] + '</option>'; }).join('') + '</select> <button data-act="pay" data-id="' + b.id + '" style="' + BTN + '">รับชำระ</button>') + '</td></tr>';
      }).join('') +
      (rows.length ? '' : '<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b">ไม่มีบิลในรายการนี้</td></tr>') +
      '</tbody></table></div></section>';
  }

  function editorHTML(id) {
    var s = S.stalls.find(function (x) { return x.id === id; });
    if (!s) return '';
    return '<section style="background:#fff;border:1px solid #7dd3fc;border-radius:12px;padding:16px;margin-bottom:16px"><h2 style="font:600 15px sans-serif;margin:0 0 12px">จัดการแผง ' + esc(s.id) + '</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">' +
      '<label style="font:14px sans-serif">สถานะ<select id="edStatus" style="' + INP + ';width:100%;margin-top:4px">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (s.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label style="font:14px sans-serif">ชื่อผู้จอง / ผู้เช่า<input id="edTenant" value="' + esc(s.tenant || '') + '" style="' + INP + ';width:100%;margin-top:4px"></label>' +
      '<label style="font:14px sans-serif">ค่าเช่าต่อเดือน (บาท)<input id="edRate" type="number" min="0" value="' + s.rate + '" style="' + INP + ';width:100%;margin-top:4px"></label></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button data-act="close" style="' + BTN2 + '">ปิด</button><button data-act="save" data-id="' + esc(s.id) + '" style="' + BTN + '">บันทึก</button></div></section>';
  }

  // ───── ค่าเก็บขยะบ้าน ─────
  function normalize(q) { return String(q || '').replace(/[๐-๙]/g, function (d) { return '๐๑๒๓๔๕๖๗๘๙'.indexOf(d); }).replace(/\s+/g, ' ').trim(); }
  function householdMatches(b, query) {
    var q = normalize(query); if (!q) return false;
    var digits = q.replace(/[\s-]/g, '');
    if (/^0\d{8,9}$/.test(digits)) return String(b.phone || '').replace(/\D/g, '') === digits;
    var moo = q.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
    var rest = (moo ? q.replace(moo[0], ' ') : q).trim();
    var house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
    if (house || moo) { if (!house) return false; return b.house === house[1] && (!moo || b.moo === String(Number(moo[1]))); }
    return (b.name + ' ' + b.ref).toLowerCase().indexOf(q.toLowerCase()) >= 0;
  }
  function wasteHTML() {
    var head = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px"><button data-act="reset" style="margin-left:auto;' + BTN2 + '">รีเซ็ตข้อมูลตัวอย่าง</button></div>';
    var form = '<form data-act="search" style="display:flex;flex-wrap:wrap;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<input id="wq" value="' + esc(wq) + '" placeholder="บ้านเลขที่และหมู่ เช่น 18 หมู่ 2 · ชื่อ · หรือเบอร์โทร" style="' + INP + ';flex:1;min-width:260px">' +
      '<button type="submit" style="' + BTN + '">ค้นหา</button></form>';
    var body = '';
    if (wresults === null) body = '<p style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center;color:#64748b">ค้นหาครัวเรือนเพื่อดูบิลค่าเก็บขยะที่ค้าง</p>';
    else {
      var list = S.waste.filter(function (b) { return householdMatches(b, wq); });
      body = '<section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font:14px sans-serif"><thead style="background:#f8fafc;text-align:left;color:#475569"><tr>' +
        '<th style="padding:8px 12px">รหัส</th><th style="padding:8px 12px">ผู้รับบิล</th><th style="padding:8px 12px">บ้านเลขที่</th><th style="padding:8px 12px">งวด</th><th style="padding:8px 12px;text-align:right">ยอด</th><th style="padding:8px 12px">สถานะ</th><th style="padding:8px 12px">รับชำระ</th></tr></thead><tbody>' +
        list.map(function (b) {
          var paid = b.status === 'paid';
          return '<tr style="border-top:1px solid #f1f5f9"><td style="padding:8px 12px;font-weight:600">' + esc(b.ref) + '</td><td style="padding:8px 12px">' + esc(b.name) + '</td><td style="padding:8px 12px">' + esc(b.house) + ' หมู่ ' + Number(b.moo) + '</td><td style="padding:8px 12px">' + plabel(b.period) + '</td><td style="padding:8px 12px;text-align:right">' + money(b.amount) + '</td>' +
            '<td style="padding:8px 12px">' + BILL[b.status] + (paid ? '<div style="color:#64748b;font-size:12px">' + METHOD[b.method] + ' · ' + esc(b.receipt) + '</div>' : '') + '</td>' +
            '<td style="padding:8px 12px">' + (paid ? '' : '<select data-act="method" data-id="' + b.id + '" style="' + INP + ';padding:4px 6px">' + Object.keys(METHOD).map(function (k) { return '<option value="' + k + '"' + ((method[b.id] || 'cash') === k ? ' selected' : '') + '>' + METHOD[k] + '</option>'; }).join('') + '</select> <button data-act="pay" data-id="' + b.id + '" style="' + BTN + '">รับชำระ</button>') + '</td></tr>';
        }).join('') +
        (list.length ? '' : '<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b">ไม่พบบิลค้างจากคำค้นนี้</td></tr>') + '</tbody></table></section>';
    }
    return head + form + body;
  }

  // ───── การทำงาน ─────
  function render() {
    app.innerHTML = MODE === 'waste' ? wasteHTML() : marketHTML();
  }
  function pay(id) {
    var b = S.bills.find(function (x) { return x.id === id; }) || S.waste.find(function (x) { return x.id === id; });
    if (!b || b.status === 'paid') return;
    var m = method[id] || 'cash';
    b.status = 'paid'; b.method = m; b.paidAt = new Date().toISOString();
    b.receipt = receiptNo(MODE === 'waste' ? 'WS' : 'MK', b.period);
    save(); toast('บันทึกการรับชำระแล้ว · ' + b.receipt); render();
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'view') { view = el.getAttribute('data-v'); editing = null; render(); }
    else if (act === 'edit') { editing = el.getAttribute('data-id'); render(); }
    else if (act === 'close') { editing = null; render(); }
    else if (act === 'save') {
      var s = S.stalls.find(function (x) { return x.id === el.getAttribute('data-id'); });
      if (s) {
        s.status = document.getElementById('edStatus').value;
        s.tenant = s.status === 'available' ? null : (document.getElementById('edTenant').value.trim() || null);
        s.rate = Number(document.getElementById('edRate').value) || 0;
        save(); editing = null; toast('บันทึกแผง ' + s.id + ' แล้ว'); render();
      }
    }
    else if (act === 'pay') pay(el.getAttribute('data-id'));
    else if (act === 'reset') { if (confirm('รีเซ็ตข้อมูลตัวอย่างทั้งหมดกลับเป็นค่าเริ่มต้น?')) { S = fresh(); save(); method = {}; wresults = null; wq = ''; editing = null; toast('รีเซ็ตข้อมูลตัวอย่างแล้ว'); render(); } }
  });
  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-act') === 'filter') { billStatus = el.value; render(); }
    else if (el.getAttribute('data-act') === 'method') { method[el.getAttribute('data-id')] = el.value; }
  });
  app.addEventListener('submit', function (e) {
    if (e.target.getAttribute('data-act') !== 'search') return;
    e.preventDefault();
    wq = (document.getElementById('wq').value || '').trim();
    wresults = wq ? [] : null;
    render();
  });

  render();
})();
