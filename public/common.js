const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(url, body, method) {
  const r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'صار خطأ، حاول مرة ثانية'); e.status = r.status; throw e; }
  return j;
}
function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2500); }
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function fmtDate(d) { const x = new Date(d + 'T12:00:00Z'); return `${DAYS[x.getUTCDay()]} ${x.getUTCDate()}/${x.getUTCMonth() + 1}/${x.getUTCFullYear()}`; }
function addDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
const num = n => (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-US');
const sar = n => `${num(n)} ريال`;
const STATUS = { new: 'جديدة', prepared: 'جاهزة', delivered: 'تم التوصيل', cancelled: 'ملغاة' };
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

// أزرار الكمية: للحبة خطوات كبيرة (±50 و +100)، لغيرها ±1 و +5
const STEPS = unit => (unit === 'حبة' || unit === 'قطعة') ? [50, 100] : [1, 5];
function qtyBox(data, val, unit, dis) {
  const [s1, s2] = STEPS(unit), d = dis ? 'disabled' : '';
  return `<div class="qty qty4"><button type="button" ${data} data-d="-${s1}" ${d}>−${s1}</button><input ${data} inputmode="numeric" value="${val || 0}" ${d}><button type="button" ${data} data-d="${s1}" ${d}>+${s1}</button><button type="button" ${data} data-d="${s2}" ${d}>+${s2}</button></div>`;
}
