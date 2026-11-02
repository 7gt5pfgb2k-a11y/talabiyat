// «أحمد» كمان دليل مساعدة: أسئلة جاهزة بخطوات قصيرة — بدون إنترنت، بدون ذكاء اصطناعي، بدون تكلفة
// كل نص هنا بينعرض بعد esc(). «وريني» بيفتح الشاشة وبيأشّر على الزر المطلوب.
const HELP = [
  { id: 'order', icon: '🎤', q: 'كيف أسجّل طلبية جديدة؟', k: 'طلبيه طلب صوت كلام ميكروفون كتابه بكره مطعم كميه', go: '#/day', hl: '#mic,#otext',
    s: ['افتح «الطلبات» من تحت.', 'اضغط 🎤 واحكي: اسم المطعم، الكمية، واليوم. مثلاً: «السرايا 200 ورق عنب بكرة». أو اكتبها بالمربع.', 'اضغط «التالي ✓» وراجع الأرقام.', 'اضغط «✅ تأكيد وحفظ».'] },
  { id: 'customer', icon: '🏪', q: 'كيف أضيف زبون (مطعم) جديد؟', k: 'زبون مطعم جديد اضافه رقم جوال عنوان موقع', go: '#/customers', hl: '#radd',
    s: ['افتح «الزبائن» من تحت.', 'اضغط «➕ زبون جديد».', 'اكتب اسم المطعم ورقم الجوال. لو إنت عند المطعم اضغط «📍 موقعي الحالي».', 'اضغط «حفظ».'] },
  { id: 'pause', icon: '⏸', q: 'كيف أوقف زبون أو أرجّعه؟', k: 'ايقاف وقف زبون تفعيل رجوع مطعم موقوف', go: '#/customers', hl: '[data-act],#radd',
    s: ['افتح «الزبائن».', 'عند اسم المطعم اضغط «⏸ إيقاف»، وبعدين «نعم، أوقفه».', 'لترجّعه: اضغط «▶ إعادة تفعيل».', 'حساباته وطلبياته القديمة بتضل محفوظة.'] },
  { id: 'materials', icon: '🧂', q: 'كيف أدخّل المواد الخام وأسعارها؟', k: 'مواد خام سعر شراء تكلفه وصفه صنف سعر بيع رز ورق', go: '#/ingredients', hl: '#iadd',
    s: ['من «المزيد» اضغط «🧂 المواد الخام وأسعارها».', 'اضغط «➕ مادة خام جديدة»، واكتب الاسم وبكم اشتريتها وكم الكمية.', 'سعر البيع: من «المزيد» ← «🥬 الأصناف» ← «✏️ الصنف والسعر».', 'كم بيدخل من كل مادة بالصنف: اضغط «🧪 الوصفة».'] },
  { id: 'stock', icon: '📦', q: 'كيف أدخّل المخزون؟', k: 'مخزون جرد استلام كميه وصلت بضاعه خلص', go: '#/stock', hl: '[data-add],[data-cnt],a[href="#/ingredients"]',
    s: ['من «المزيد» اضغط «📦 المخزون».', 'لما توصلك بضاعة: اضغط «➕ استلمت كمية» واكتب الكمية.', 'مرة بالأسبوع: اضغط «⚖️ جرد» واكتب الموجود عندك بالضبط.', 'أنا بحسب متى بتخلص كل مادة وبنبّهك.'] },
  { id: 'route', icon: '🚗', q: 'كيف أشوف الخريطة وخط التوصيل؟', k: 'خريطه توصيل خط طريق موقع جوجل سواق', go: '#/route', hl: '#map',
    s: ['افتح «التوصيل» من تحت.', 'بتشوف المطاعم على الخريطة بالترتيب.', 'رتّبهم بالأسهم ▲▼ — الترتيب بينحفظ.', 'اضغط «🗺️ الخريطة» عند أي مطعم ليفتح خرائط جوجل، وبعد التوصيل اضغط «🚚 تم التوصيل».'] },
  { id: 'payment', icon: '💵', q: 'كيف أسجّل دفعة من زبون؟', k: 'دفعه فلوس مصاري استلام حساب كشف دين رصيد', go: '#/money', hl: '#pay',
    s: ['افتح «الحسابات» من تحت.', 'اضغط «💵 استلام دفعة».', 'اختر المطعم واكتب المبلغ.', 'اضغط «حفظ». كشف الحساب بيتحدّث لحاله.'] },
  { id: 'expense', icon: '🧾', q: 'كيف أسجّل مصروف؟', k: 'مصروف مصاريف كهربا ايجار رواتب مورد فاتوره', go: '#/expenses', hl: '#eadd',
    s: ['من «المزيد» اضغط «🧾 المصاريف».', 'اضغط «➕ مصروف جديد».', 'اختر النوع واكتب المبلغ.', 'اضغط «حفظ».'] },
  { id: 'backup', icon: '💾', q: 'كيف أعمل نسخة احتياطية وأرجّعها؟', k: 'نسخه احتياطيه حفظ استعاده جوال جديد ضاع بيانات واتساب ملفات', go: '#/more', hl: '#bk',
    s: ['افتح «المزيد».', 'اضغط «💾 نسخ احتياطي» واحفظ الملف في «الملفات» أو ابعته لنفسك على واتساب. اعملها كل أسبوع.', 'لترجّع البيانات (مثلاً بجوال جديد): اضغط «♻️ استعادة» واختر الملف.', 'انتبه: الاستعادة بتمسح اللي على الجوال وبتحط مكانه النسخة.'] },
  { id: 'pin', icon: '🔒', q: 'كيف أغيّر الرقم السري؟', k: 'رقم سري كلمه سر قفل تغيير بين', go: '#/settings', hl: '#pw_c',
    s: ['من «المزيد» اضغط «⚙️ الإعدادات».', 'اكتب الرقم الحالي، وبعدين الرقم الجديد مرتين.', 'اضغط «تغيير الرقم السري» وبعدين «نعم، غيّر الرقم».', 'احفظ الرقم الجديد بمكان أمين.'] },
  { id: 'install', icon: '📲', q: 'كيف أحط التطبيق على شاشة الآيفون؟', k: 'تثبيت ايفون شاشه رئيسيه ايقونه سفاري تطبيق', install: true,
    s: ['افتح الموقع من «Safari».', 'اضغط زر المشاركة ⬆️ تحت بالنص.', 'انزل واضغط «إضافة إلى الشاشة الرئيسية».', 'اضغط «إضافة». بعدها افتح «طلبيات» من الأيقونة دايماً.'] },
];
// بحث بسيط: نوحّد الحروف (أ/إ/آ ← ا، ة ← ه، ى ← ي) ونشيل التشكيل
const helpNorm = s => String(s).replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
function helpFind(q) {
  const w = helpNorm(q).split(/\s+/).filter(x => x.length > 1); if (!w.length) return HELP;
  return HELP.map(t => { const h = helpNorm(t.q + ' ' + t.k + ' ' + t.s.join(' ')); return [t, w.filter(x => h.includes(x)).length]; }).filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
// ترحيب أول مرة بالفقاعة (مرة وحدة على هذا الجوال)
const HELP_KEY = 'talabiyat_help_greeted';
let _helpGreet = false; try { _helpGreet = !localStorage.getItem(HELP_KEY); } catch (_) {}
// بنعلّم «انعرض» أول ما يطلع بالفقاعة فعلاً (مش بشاشة الإعداد)، وبيضل لحد ما يضغط على أحمد أو يسكّر التطبيق
const helpGreeting = () => { if (_helpGreet) try { localStorage.setItem(HELP_KEY, '1'); } catch (_) {} return _helpGreet; };
const HELP_GREET_TEXT = `أهلًا، أنا ${AVATAR_NAME} 👋 اضغط عليّ لو احتجت مساعدة`;

function helpList(q = '') {
  const R = helpFind(q);
  return R.length ? R.map(t => `<button class="hlp-q" data-help="${esc(t.id)}"><span class="hlp-i" aria-hidden="true">${esc(t.icon)}</span><span>${esc(t.q)}</span></button>`).join('')
    : `<div class="hlp-none">ما لقيت شي بهالكلمة. جرّب كلمة ثانية مثل: طلبية، زبون، دفعة، مخزون.</div>`;
}
function openHelp(id) {
  const wasGreet = _helpGreet; _helpGreet = false;
  if (typeof _avOpen !== 'undefined' && (_avOpen || wasGreet)) { _avOpen = false; renderAvatarBar(); }
  const t = id && HELP.find(x => x.id === id);
  if (t) {
    const done = t.install && typeof isStandalone === 'function' && isStandalone();
    modal(`<div class="hlp" id="help" data-topic="${esc(t.id)}"><div class="hlp-h">${avatarFace(52)}<h2>${esc(t.icon)} ${esc(t.q)}</h2></div>
      ${done ? '<div class="hlp-ok">✅ التطبيق مثبّت على الشاشة الرئيسية عندك.</div>' : ''}
      <ol class="hlp-steps">${t.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${t.go ? `<button class="btn block hlp-go" id="hlp_go">👀 وريني</button>` : ''}
      <button class="btn sec block" id="hlp_back" style="margin-top:10px">→ أسئلة ثانية</button>
      <button class="btn sec block" style="margin-top:10px" data-close>إغلاق ✕</button></div>`);
    $('#hlp_back').onclick = () => openHelp();
    const g = $('#hlp_go'); if (g) g.onclick = () => helpShow(t);
    return;
  }
  modal(`<div class="hlp" id="help"><div class="hlp-h">${avatarFace(52)}<h2>${esc(AVATAR_NAME)}: كيف بقدر أساعدك؟</h2></div>
    <input id="hlp_s" type="search" placeholder="🔎 اكتب كلمة… مثلاً: دفعة، زبون، مخزون" aria-label="ابحث بالمساعدة">
    <div class="hlp-list" id="hlp_l">${helpList()}</div>
    <button class="btn sec block" style="margin-top:12px" data-close>إغلاق ✕</button></div>`);
  const bind = () => $('#hlp_l').querySelectorAll('[data-help]').forEach(b => b.onclick = () => openHelp(b.dataset.help));
  $('#hlp_s').oninput = () => { $('#hlp_l').innerHTML = helpList($('#hlp_s').value); bind(); };
  bind();
}
// «وريني»: افتح الشاشة وأشّر على الزر المطلوب
function helpShow(t) {
  modal('');
  if (location.hash === t.go) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = t.go;
  let n = 0; const tryHl = () => {
    const el = t.hl && document.querySelector(t.hl.split(',').map(s => '#app ' + s).join(','));
    if (!el) { if (++n < 12) setTimeout(tryHl, 150); return; }
    el.scrollIntoView({ block: 'center' }); el.classList.add('hlp-pulse'); setTimeout(() => el.classList.remove('hlp-pulse'), 4000);
  };
  setTimeout(tryHl, 250);
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-openhelp]'); if (b) openHelp(); });
