// المساعد اللي بيراقب المخزون — كل الحسابات على الجهاز (store.js ← /api/m/stock)
const AVATAR_NAME = 'أحمد'; // اسم المساعد: غيّره هون فقط
const AVATAR_IMG = 'icons/avatar-ahmed.jpg';
const AVATAR_FALLBACK = '🧑‍🍳';
function avatarFace(size = 64, level = 'ok') {
  const ring = level === 'red' ? 'var(--red)' : level === 'yellow' ? '#d08a00' : 'var(--g)';
  return `<span class="av" style="width:${size}px;height:${size}px;border-color:${ring}"><img src="${AVATAR_IMG}" alt="${esc(AVATAR_NAME)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'avfb',textContent:'${AVATAR_FALLBACK}'}))"></span>`;
}
const stockAmt = (a, u) => a == null ? '—' : (u === 'كغ' && Math.abs(a) < 1 ? `${num(Math.round(a * 1000))} غرام` : u === 'لتر' && Math.abs(a) < 1 ? `${num(Math.round(a * 1000))} مل` : `${num(Math.round(a * 10) / 10)} ${u}`);
const daysTxt = d => { const n = Math.floor(d); return d <= 0 ? 'خلص!' : n < 1 ? 'أقل من يوم' : n === 1 ? 'حوالي يوم واحد' : n === 2 ? 'حوالي يومين' : `حوالي ${num(n)} ${n <= 10 ? 'أيام' : 'يوم'}`; };
const alertLine = i => `<div class="avi ${i.level}"><b>${i.level === 'red' ? '🔴' : '🟡'} ${esc(i.name)}</b>: ${i.days_left <= 0 ? 'خلص أو قرّب يخلص — اطلب الآن' : `باقي ${daysTxt(i.days_left)} — يخلص تقريباً ${fmtDate(i.runout)}`}<div class="mut">الموجود تقريباً: ${stockAmt(i.stock, i.unit)}${i.rate ? ` • الصرف اليومي حوالي ${stockAmt(i.rate, i.unit)}` : ''}</div></div>`;

// بطاقة الشاشة الرئيسية: تنبيهات فقط، وسطر واحد لما كل شي تمام
async function avatarCard() {
  let S; try { S = await api('/api/m/stock'); } catch (_) { return ''; }
  const worst = S.alerts.some(i => i.level === 'red') ? 'red' : S.alerts.length ? 'yellow' : 'ok';
  const head = msg => `<div class="avh">${avatarFace(60, worst)}<div><div class="avn">${esc(AVATAR_NAME)}</div><div class="avm">${msg}</div></div></div>`;
  const note = `<div class="mut" style="margin-top:6px">⚠️ تقدير حسب الاستهلاك في آخر ${S.window_days} يوم (الطلبيات × الوصفات)</div>`;
  const notif = ('Notification' in window && Notification.permission === 'default' && S.alerts.length) ? '<button class="btn sec sm block" id="av_notif" style="margin-top:8px">🔔 نبّهني بإشعار كمان</button>' : '';
  if (S.alerts.length) return `<div class="card avcard ${worst}" id="avatar">${head(`في ${S.alerts.length} ${S.alerts.length > 2 && S.alerts.length < 11 ? 'مواد' : 'مادة'} قرّبت تخلص`)}${S.alerts.map(alertLine).join('')}${note}
    <a class="btn ${worst === 'red' ? 'red' : 'warn'} block" href="#/stock" style="margin-top:10px">📦 المخزون</a>${notif}</div>`;
  if (!S.items.length) return '';
  if (!S.tracked) return `<div class="card avcard" id="avatar">${head('دخّل الكمية الموجودة عندك من كل مادة، وأنا بقلك قبل ما تخلص 👍')}<a class="btn sec block" href="#/stock" style="margin-top:10px">📦 إدخال المخزون</a></div>`;
  const tracked = S.items.filter(i => i.stock != null);
  const msg = tracked.some(i => i.level === 'ok') ? 'المخزون تمام 👍' : S.window_days < S.min_days ? `لسا بجمع بيانات الاستهلاك (${S.window_days} من ${S.min_days} أيام)` : 'المخزون مسجّل، بس ما في استهلاك كافي للحساب';
  return `<a class="card avcard ok" id="avatar" href="#/stock" style="display:block;text-decoration:none;color:inherit">${head(msg)}</a>`;
}
function bindAvatarCard() { const b = $('#av_notif'); if (b) b.onclick = async () => { try { await Notification.requestPermission(); } catch (_) {} b.remove(); avatarRefresh(); }; }

// شاشة المخزون
async function stockView() {
  const S = await api('/api/m/stock');
  const lvl = i => i.level === 'red' ? 'red' : i.level === 'yellow' ? 'yellow' : i.level === 'ok' ? 'ok' : '';
  const why = i => i.stock == null ? 'ما دخّلت الكمية الموجودة لسا' : i.reason === 'few_days' ? `ما في بيانات كافية لسا (لازم ${S.min_days} أيام على الأقل، موجود ${S.window_days})` : i.reason === 'no_recipe' ? 'المادة مش داخلة في أي وصفة' : i.reason === 'no_use' ? 'ما انصرف منها شي بآخر الأيام' : '';
  app.innerHTML = `<div class="card avcard"><div class="avh">${avatarFace(72, S.alerts.some(i => i.level === 'red') ? 'red' : S.alerts.length ? 'yellow' : 'ok')}<div><div class="avn">${esc(AVATAR_NAME)}</div><div class="avm">أنا براقب المخزون وبحسب متى بتخلص كل مادة.</div></div></div>
    <div class="mut" style="margin-top:6px">الحساب تقديري: الاستهلاك اليومي = معدل آخر ${S.window_days || 0} يوم (من 7 لـ 14) من الطلبيات × الوصفات، والأيام الباقية = الموجود ÷ الاستهلاك اليومي. 🔴 أقل من ${S.red_days} أيام، 🟡 أقل من ${S.yellow_days}.</div></div>
  ${S.items.map(i => `<div class="card stk ${lvl(i)}" data-ing="${i.id}"><div class="row"><b style="font-size:21px">${esc(i.name)}</b><b style="flex:0 0 auto;font-size:21px">${stockAmt(i.stock, i.unit)}</b></div>
    ${i.days_left != null ? `<div class="stk-d">${i.level === 'red' ? '🔴' : i.level === 'yellow' ? '🟡' : '🟢'} يكفي ${daysTxt(i.days_left)}${i.days_left > 0 ? ` — لحد ${fmtDate(i.runout)} تقريباً` : ''}</div>` : `<div class="mut">${esc(why(i))}</div>`}
    ${i.rate ? `<div class="mut">الصرف اليومي حوالي ${stockAmt(i.rate, i.unit)}</div>` : ''}
    <div class="grid2" style="margin-top:8px"><button class="btn sm" data-add="${i.id}">➕ استلمت كمية</button><button class="btn sec sm" data-cnt="${i.id}">⚖️ جرد (الموجود الآن)</button></div></div>`).join('') || '<div class="card mut">أضف المواد الخام أولاً من «المزيد ← المواد الخام»، وحطّ وصفة لكل صنف.</div>'}
  <a class="btn sec block" href="#/ingredients">🧂 المواد الخام</a>`;
  const form = (i, kind) => {
    modal(`<h2 style="margin-top:0">${kind === 'add' ? '➕ استلمت' : '⚖️ جرد'} — ${esc(i.name)}</h2><div class="mut">${kind === 'add' ? 'الكمية اللي وصلت' : 'الكمية الموجودة عندك الآن بالضبط'} (${esc(i.unit)})</div>
     <input id="st_q" inputmode="decimal" style="font-size:30px;text-align:center;margin-top:8px" placeholder="0">
     <div style="height:12px"></div><button class="btn block" id="st_s" style="min-height:68px">حفظ ✓</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
    $('#st_q').focus();
    $('#st_s').onclick = async () => { try { await api('/api/m/stock/' + i.id, { kind, qty: $('#st_q').value.trim() }); modal(''); toast('تم الحفظ ✅'); stockView(); } catch (e) { toast(e.message); } };
  };
  app.querySelectorAll('[data-add]').forEach(b => b.onclick = () => form(S.items.find(x => x.id == b.dataset.add), 'add'));
  app.querySelectorAll('[data-cnt]').forEach(b => b.onclick = () => form(S.items.find(x => x.id == b.dataset.cnt), 'count'));
}

// يعيد الحساب تلقائياً بعد أي تعديل (طلبية/مخزون/وصفة): شارة + إشعار اختياري
let _avT = null;
function avatarRefresh() { clearTimeout(_avT); _avT = setTimeout(_avatarRefresh, 150); }
async function _avatarRefresh() {
  let S; try { S = await api('/api/m/stock'); } catch (_) { return; }
  const red = S.alerts.filter(i => i.level === 'red'), n = S.alerts.length;
  const a = document.querySelector('#nav a[data-t="day"]');
  if (a) { let bd = a.querySelector('.nbadge'); if (!bd) { bd = document.createElement('span'); bd.className = 'nbadge'; bd.id = 'av_badge'; a.appendChild(bd); }
    bd.textContent = n; bd.style.display = n ? '' : 'none'; bd.classList.toggle('red', red.length > 0); }
  try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (_) {}
  // إشعار محلي مرة وحدة لكل مجموعة تنبيهات حمراء باليوم (إذا الإذن موجود؛ مش ضروري)
  try {
    if (!red.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const key = S.today + ':' + red.map(i => i.id).sort().join(','); if (localStorage.getItem('talabiyat_av_notified') === key) return;
    localStorage.setItem('talabiyat_av_notified', key);
    const body = red.map(i => `${i.name}: ${i.days_left <= 0 ? 'خلص' : 'باقي ' + daysTxt(i.days_left)}`).join('\n') + '\n(تقدير)';
    const title = `${AVATAR_NAME}: مواد قرّبت تخلص`;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) await reg.showNotification(title, { body, icon: AVATAR_IMG, tag: 'stock' }); else new Notification(title, { body, icon: AVATAR_IMG });
  } catch (_) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof L !== 'undefined' && L) avatarRefresh(); });
setInterval(() => { if (typeof L !== 'undefined' && L) avatarRefresh(); }, 30 * 60e3);
