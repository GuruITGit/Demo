/** ปุ่มขนาดตัวหนังสือบนหัวเว็บ (มือถือตัวเล็กเกินไป) — กดวนได้ 3 ขนาด · จำค่าไว้ใน localStorage · เก็บไม่ได้ก็ใช้ขนาดปกติ */
const TEXT_SIZE_STEPS = [1, 1.15, 1.3];
const TEXT_SIZE_LABELS = ['Aa', 'Aa+', 'Aa++'];
const TEXT_SIZE_KEY = 'citizen:textSize';

function readTextSizeStep(): number {
  try {
    const v = Number(localStorage.getItem(TEXT_SIZE_KEY));
    return Number.isInteger(v) && v >= 0 && v < TEXT_SIZE_STEPS.length ? v : 0;
  } catch { return 0; }
}

function applyTextSizeStep(step: number) {
  // zoom ทั้งหน้า (ใช้ var --text-scale) — ตัวอักษร ปุ่ม และช่องกรอกขยายพร้อมกัน
  document.documentElement.style.setProperty('--text-scale', String(TEXT_SIZE_STEPS[step]));
  const btn = document.getElementById('textSizeBtn');
  if (btn) {
    const next = (step + 1) % TEXT_SIZE_STEPS.length;
    btn.textContent = TEXT_SIZE_LABELS[step];
    btn.setAttribute('aria-label', `ขนาดตัวหนังสือ ${TEXT_SIZE_LABELS[step]} กดเพื่อเปลี่ยนเป็น ${TEXT_SIZE_LABELS[next]}`);
  }
}

function initTextSizeControl() {
  const header = document.querySelector('.sao-header-in');
  if (!header || document.getElementById('textSizeBtn')) return;
  let step = readTextSizeStep();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'textSizeBtn';
  btn.className = 'text-size-btn';
  btn.addEventListener('click', () => {
    step = (step + 1) % TEXT_SIZE_STEPS.length;
    try { localStorage.setItem(TEXT_SIZE_KEY, String(step)); } catch { /* ไม่ต้องจำก็ได้ */ }
    applyTextSizeStep(step);
  });
  header.appendChild(btn);
  applyTextSizeStep(step);
}

initTextSizeControl();
