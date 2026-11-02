const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// كل الطلبات تذهب لقاعدة البيانات المحلية على الجهاز (store.js)
const api = async (url, body, method) => {
  const r = await Store.api(url, body, method);
  if ((method || (body ? 'POST' : 'GET')) !== 'GET' && typeof avatarRefresh === 'function') avatarRefresh(); // إعادة حساب المخزون بعد أي تعديل
  return r;
};
function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2500); }
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function fmtDate(d) { const x = new Date(d + 'T12:00:00Z'); return `${DAYS[x.getUTCDay()]} ${x.getUTCDate()}/${x.getUTCMonth() + 1}/${x.getUTCFullYear()}`; }
function addDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
const num = n => (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-US');
const sar = n => `${num(n)} ريال`;
const STATUS = { new: 'جديدة', prepared: 'جاهزة', delivered: 'تم التوصيل', cancelled: 'ملغاة' };
// تحديثات أسرع: نفحص النسخة الجديدة عند كل فتح، ولما تجهز نعيد التحميل مرة وحدة (أو نعرض زر تحديث لو في شغل مفتوح)
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(() => {}));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || window.__swReloading) return;
    const busy = ($('#modal') && $('#modal').innerHTML) || ($('#otext') && $('#otext').value.trim()) || document.querySelector('input:focus,textarea:focus');
    if (!busy && !sessionStorage.getItem('talabiyat_sw_reloaded')) { window.__swReloading = true; sessionStorage.setItem('talabiyat_sw_reloaded', '1'); location.reload(); return; }
    if ($('#updbar')) return;
    const b = document.createElement('button'); b.id = 'updbar'; b.className = 'updbar'; b.textContent = '🔄 تحديث جديد، اضغط للتحديث';
    b.onclick = () => { window.__swReloading = true; location.reload(); }; document.body.appendChild(b);
  });
  window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('talabiyat_sw_reloaded'), 10000));
}

// أزرار الكمية: للحبة خطوات كبيرة (±50 و +100)، لغيرها ±1 و +5
const STEPS = unit => (unit === 'حبة' || unit === 'قطعة') ? [50, 100] : [1, 5];
function qtyBox(data, val, unit, dis) {
  const [s1, s2] = STEPS(unit), d = dis ? 'disabled' : '';
  return `<div class="qty qty4"><button type="button" ${data} data-d="-${s1}" ${d}>−${s1}</button><input ${data} inputmode="numeric" value="${val || 0}" ${d}><button type="button" ${data} data-d="${s1}" ${d}>+${s1}</button><button type="button" ${data} data-d="${s2}" ${d}>+${s2}</button></div>`;
}

// هل التطبيق مفتوح من أيقونة الشاشة الرئيسية؟
const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installWarning() {
  if (isStandalone()) return '';
  return `<div class="card warnbox"><div style="font-size:21px;font-weight:800">⚠️ مهم قبل ما تبدأ</div>
   <p>ثبّت التطبيق على الشاشة الرئيسية أولاً، وبعدها <b>استخدمه من الأيقونة فقط</b>.</p>
   <ol style="padding-inline-start:22px;margin:6px 0;font-size:18px;line-height:1.9">
    ${isIOS() ? '<li>اضغط زر المشاركة <b>⬆️</b> تحت في Safari</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>اضغط <b>«إضافة»</b> وافتح التطبيق من أيقونة <b>طلبيات</b></li>'
      : '<li>افتح قائمة المتصفح <b>⋮</b></li><li>اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>افتح التطبيق من أيقونة <b>طلبيات</b></li>'}
   </ol>
   <p class="mut" style="margin:0">البيانات اللي بتدخلها هون في المتصفح (Safari) <b>منفصلة</b> عن بيانات التطبيق المثبّت وما بتنتقل له.</p></div>`;
}
