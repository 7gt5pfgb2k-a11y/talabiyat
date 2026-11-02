const app = $('#app');
let L = null; // lookups: products, restaurants, today
let dayDate = null;
const modal = html => { $('#modal').innerHTML = html ? `<div class="modal"><div class="sheet">${html}</div></div>` : ''; };
const mapLink = r => r.map_url ? r.map_url : r.lat != null ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}` : (r.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}` : '');
const telLink = p => p ? `tel:${String(p).replace(/[^\d+]/g, '')}` : '';
const waShare = text => `https://wa.me/?text=${encodeURIComponent(text)}`;

async function start() {
  const me = await api('/api/me');
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // اطلب من المتصفح ما يمسح البيانات
  if (!me.has_pin) return setupView();
  if (me.role !== 'manager') return loginView();
  $('#logout').style.display = ''; $('#logout').onclick = async () => { await api('/api/logout', {}); location.reload(); };
  $('#nav').style.display = '';
  L = await api('/api/m/lookups'); dayDate = L.today;
  window.addEventListener('hashchange', route); route(); avatarRefresh();
}
// أول تشغيل: يختار المدير رقمه السري (لا يوجد رقم افتراضي)
function setupView() {
  app.innerHTML = `${installWarning()}<div class="card"><h2 style="margin-top:0">أهلاً 👋 أول مرة</h2>
   <p class="mut">اختر رقم سري للتطبيق (4–8 أرقام). احفظه منيح، ما في طريقة لاسترجاعه.</p>
   <label>اسم المعمل</label><input id="su_n" value="معمل الأكل البيتي">
   <label>الرقم السري</label><input id="su_p" inputmode="numeric" type="password" autocomplete="new-password">
   <label>أعد كتابة الرقم السري</label><input id="su_p2" inputmode="numeric" type="password" autocomplete="new-password">
   <div style="height:14px"></div><button class="btn block" id="su_s" style="min-height:68px">ابدأ ✓</button></div>`;
  $('#su_s').onclick = async () => { try { await api('/api/setup', { factory_name: $('#su_n').value, pin: $('#su_p').value.trim(), confirm: $('#su_p2').value.trim() }); location.reload(); } catch (e) { toast(e.message); } };
}
function loginView() {
  let pin = '';
  app.innerHTML = `${installWarning()}<div class="card center"><h2>دخول المدير</h2><p class="mut">اكتب الرقم السري</p>
   <div id="dots" style="font-size:40px;letter-spacing:12px;min-height:60px">&nbsp;</div>
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;direction:ltr">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button class="btn ${k === '✓' ? '' : 'sec'}" style="font-size:30px;min-height:72px" data-k="${k}">${k}</button>`).join('')}</div></div>`;
  app.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
    const k = b.dataset.k;
    if (k === '⌫') pin = pin.slice(0, -1); else if (k === '✓') { try { await api('/api/manager/login', { pin }); location.reload(); } catch (e) { toast(e.message); pin = ''; } } else if (pin.length < 8) pin += k;
    $('#dots').textContent = pin ? '•'.repeat(pin.length) : '\u00a0';
  });
}
function route() {
  const [, tab, a, b] = (location.hash || '#/day').split('/');
  document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x.dataset.t === ((tab === 'print' || tab === 'needs') ? 'day' : tab === 'statement' ? 'money' : tab)));
  modal(''); window.scrollTo(0, 0);
  const views = { day: dayView, route: routeView, money: moneyView, customers: customersView, more: moreView, print: printView, statement: statementView, history: historyView, needs: needsView, ingredients: ingredientsView, products: productsView, settings: settingsView, expenses: expensesView, stock: stockView };
  (views[tab] || dayView)(a, b).catch(e => { if (e.status === 401) location.reload(); app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
  $('#title').textContent = { day: 'الطلبات', route: 'التوصيل', money: 'الحسابات', customers: 'الزبائن', more: 'المزيد', print: 'ورقة اليوم', statement: 'كشف حساب', history: 'السجل', needs: 'المواد المطلوبة', ingredients: 'المواد الخام', products: 'الأصناف', settings: 'الإعدادات', expenses: 'المصاريف', stock: 'المخزون' }[tab] || 'الطلبات';
}
const dateBar = (d, id) => `<div class="datebar no-print"><button class="btn sec sm" id="${id}-prev" title="اليوم السابق">▶</button><div class="d">${d === L.today ? 'اليوم' : d === addDays(L.today, 1) ? 'بكرة' : d === addDays(L.today, -1) ? 'أمس' : ''} ${fmtDate(d)}</div><button class="btn sec sm" id="${id}-next" title="اليوم التالي">◀</button></div>`;
function bindDateBar(id, cb) { $(`#${id}-next`).onclick = () => { dayDate = addDays(dayDate, 1); cb(); }; $(`#${id}-prev`).onclick = () => { dayDate = addDays(dayDate, -1); cb(); }; }

// ================= الطلبات (الشاشة الرئيسية) =================
async function dayView() {
  const D = await api('/api/m/day?date=' + dayDate);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const REM = await api('/api/m/reminders').catch(() => []);
  const AV = await avatarCard();
  app.innerHTML = `${installWarning()}
  ${AV}
  ${REM.length ? `<div class="card remind"><div style="font-size:19px;font-weight:800;margin-bottom:6px">🔔 تنبيهات</div>${REM.map(r => `<div class="ritem">${r.kind === 'backup' ? '💾' : r.kind === 'supplier' ? '🧾' : r.kind === 'old' ? '🚚' : '📞'} ${esc(r.text)}</div>`).join('')}
    ${REM.some(r => r.kind === 'backup') ? '<button class="btn block" id="bk_now" style="margin-top:10px;min-height:64px">💾 نسخ احتياطي الآن</button>' : ''}</div>` : ''}
  ${L.restaurants.length ? '' : `<div class="card"><b>ابدأ بإضافة زبائنك</b> من تبويب «الزبائن» 🏪، وحدّد سعر الحبة من «المزيد ← الأصناف».<div class="row" style="margin-top:10px"><a class="btn sec sm" href="#/customers">🏪 إضافة زبون</a><button class="btn sec sm" id="rs_first">♻️ استعادة نسخة</button></div></div>`}
  <div class="card" style="border:3px solid var(--g)">
    <div style="font-size:21px;font-weight:800;margin-bottom:6px">➕ طلبية جديدة</div>
    <div class="mut">احكي أو اكتب، مثال: «السرايا 200 حبة ورق عنب و 100 ملفوف بكرة»</div>
    <textarea id="otext" rows="3" placeholder="اكتب الطلبية هنا…" style="margin-top:8px"></textarea>
    <div class="row" style="margin-top:10px">
      ${SR ? `<button class="btn" id="mic" style="flex:0 0 96px;min-height:72px;font-size:34px;border-radius:50%">🎤</button>` : ''}
      <button class="btn" id="parse" style="min-height:72px">التالي ✓</button>
    </div>
    ${SR ? '' : '<div class="mut" style="margin-top:6px">للكلام: اضغط زر الميكروفون في الكيبورد 🎙️</div>'}
    <button class="btn sec sm block" id="manual" style="margin-top:10px">أو اختر المطعم والكميات بنفسي</button>
  </div>
  ${dateBar(D.date, 'db')}
  <h2>المطلوب تحضيره</h2>
  ${D.totals.length ? D.totals.map(t => `<div class="total"><span class="n">${esc(t.name)}</span><span class="q">${num(t.qty)} <small style="font-size:20px">${esc(t.unit)}</small></span></div>`).join('') : '<div class="card mut center">لا يوجد طلبات لهذا اليوم</div>'}
  ${D.orders.length ? `<div class="grid2 no-print"><a class="btn blue" href="#/print/${D.date}">🖨️ ورقة اليوم</a><a class="btn sec" href="#/route">🚗 خط التوصيل</a></div><a class="btn sec block no-print" style="margin-top:10px" href="#/needs/${D.date}">📦 المواد الخام المطلوبة والتكلفة</a>` : ''}
  <h2>الطلبيات (${D.orders.length})</h2>
  ${D.orders.map(o => `<div class="card"><div class="row"><b style="font-size:21px">${esc(o.restaurant_name)}</b><span class="badge st-${o.status}" style="flex:0 0 auto">${STATUS[o.status]}</span></div>
     <ul class="items">${o.items.map(i => `<li><span>${esc(i.name)}</span><b>${num(i.qty)} ${esc(i.unit)}</b></li>`).join('')}</ul>
     ${o.note ? `<div class="mut">📝 ${esc(o.note)}</div>` : ''}
     <div class="row no-print" style="margin-top:8px">
       ${o.status === 'new' ? `<button class="btn blue sm" data-st="prepared" data-id="${o.id}">✔ جاهزة</button>` : ''}
       ${o.status !== 'delivered' && o.status !== 'cancelled' ? `<button class="btn sm" data-st="delivered" data-id="${o.id}">🚚 تم التوصيل</button>` : ''}
       ${o.status !== 'delivered' ? `<button class="btn sec sm" data-edit="${o.restaurant_id}">✏️ تعديل</button>` : `<button class="btn sec sm" data-st="new" data-id="${o.id}">↩ تراجع</button>`}
     </div></div>`).join('')}
  ${D.orders.length ? `<div class="card center"><span class="mut">قيمة طلبيات اليوم:</span> <b class="money">${sar(D.day_total)}</b></div>` : ''}`;
  bindDateBar('db', dayView); bindAvatarCard();
  if ($('#bk_now')) $('#bk_now').onclick = () => doBackup(dayView);
  if ($('#rs_first')) $('#rs_first').onclick = doRestore;
  app.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { await api(`/api/m/orders/${b.dataset.id}/status`, { status: b.dataset.st }); toast('تم ✅'); dayView(); });
  app.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => { const o = D.orders.find(x => x.restaurant_id == b.dataset.edit); openDraft([{ restaurant_id: o.restaurant_id, items: Object.fromEntries(o.items.map(i => [i.product_id, i.qty])), note: o.note }], D.date); });
  $('#manual').onclick = () => openDraft([{ restaurant_id: null, items: {} }], dayDate === L.today ? addDays(L.today, 1) : dayDate);
  $('#parse').onclick = () => {
    const t = $('#otext').value.trim(); if (!t) return toast('اكتب أو احكي الطلبية أولاً');
    const r = OrderParser.parse(t, L.products, L.restaurants.filter(x => x.active));
    const date = r.date_offset != null ? addDays(L.today, r.date_offset) : addDays(L.today, 1);
    openDraft(r.drafts.length ? r.drafts : [{ restaurant_id: null, items: {} }], date, t);
  };
  if (SR) {
    let rec = null, base = '';
    $('#mic').onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = true; rec.continuous = true;
      base = $('#otext').value ? $('#otext').value + ' ' : '';
      rec.onresult = e => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; $('#otext').value = base + s; };
      rec.onerror = e => { toast(e.error === 'not-allowed' ? 'اسمح للتطبيق باستخدام الميكروفون' : 'ما قدرت أسمع، جرّب مرة ثانية أو اكتب'); };
      rec.onend = () => { rec = null; const m = $('#mic'); if (m) { m.textContent = '🎤'; m.style.background = ''; } };
      rec.start(); $('#mic').textContent = '⏹'; $('#mic').style.background = 'var(--red)'; toast('احكي الطلبية… واضغط ⏹ لما تخلص');
    };
  }
}

// مسودة الطلبية: تأكيد بضغطة أو تعديل
async function openDraft(drafts, date, heard) {
  const existing = {};
  async function render() {
    for (const d of drafts) if (d.restaurant_id && existing[d.restaurant_id + date] === undefined) existing[d.restaurant_id + date] = await api(`/api/m/order?restaurant_id=${d.restaurant_id}&date=${date}`);
    const dayBtn = (off, lbl) => `<button class="btn sm ${date === addDays(L.today, off) ? '' : 'sec'}" data-day="${off}">${lbl}</button>`;
    modal(`<h2 style="margin-top:0">تأكيد الطلبية</h2>${heard ? `<div class="mut">سمعت: «${esc(heard)}»</div>` : ''}
     <label>يوم التوصيل</label><div class="row">${dayBtn(0, 'اليوم')}${dayBtn(1, 'بكرة')}${dayBtn(2, 'بعد بكرة')}</div><div class="mut center" style="margin-top:4px">${fmtDate(date)}</div>
     ${drafts.map((d, k) => { const ex = d.restaurant_id && existing[d.restaurant_id + date];
       return `<div class="card" style="margin-top:12px"><label>المطعم</label>
       <select data-r="${k}" style="${d.restaurant_id ? '' : 'border-color:var(--red)'}"><option value="">— اختر المطعم —</option>${L.restaurants.map(r => `<option value="${r.id}" ${r.id == d.restaurant_id ? 'selected' : ''}>${esc(r.name)}${r.active ? '' : ' (موقوف)'}</option>`).join('')}</select>
       ${ex ? `<div class="sample" style="margin-top:8px">⚠️ في طلبية لهذا المطعم بنفس اليوم: ${ex.items.map(i => `${esc(i.name)} ${num(i.qty)}`).join('، ')}<br><label style="display:flex;gap:8px;align-items:center;color:#6a5600"><input type="checkbox" data-add="${k}" ${d.add ? 'checked' : ''} style="width:26px;height:26px"> أضف للكمية الموجودة (بدل الاستبدال)</label></div>` : ''}
       ${L.products.map(p => `<div style="margin-top:12px"><div style="font-size:20px;font-weight:700">${esc(p.name)} <span class="mut">(${esc(p.unit)})</span></div>
         ${qtyBox(`data-k="${k}" data-p="${p.id}"`, d.items[p.id], p.unit)}${d.units && d.units[p.id] === 'كغ' && p.unit !== 'كغ' ? `<div class="warn">⚠️ قلت «كيلو» والصنف بيُحسب بـ${esc(p.unit)} — تأكد من الرقم</div>` : ''}</div>`).join('')}
       <label>ملاحظة</label><input data-note="${k}" value="${esc(d.note || '')}"></div>`; }).join('')}
     <button class="btn block" id="dsave" style="min-height:72px;font-size:24px">✅ تأكيد وحفظ</button>
     <button class="btn sec block" id="dcancel" style="margin-top:10px">إلغاء</button>`);
    const M = $('#modal');
    M.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { date = addDays(L.today, Number(b.dataset.day)); render(); });
    M.querySelectorAll('select[data-r]').forEach(s => s.onchange = () => { drafts[s.dataset.r].restaurant_id = Number(s.value) || null; render(); });
    M.querySelectorAll('[data-add]').forEach(c => c.onchange = () => drafts[c.dataset.add].add = c.checked);
    M.querySelectorAll('.qty button').forEach(b => b.onclick = () => { const d = drafts[b.dataset.k]; d.items[b.dataset.p] = Math.max(0, (Number(d.items[b.dataset.p]) || 0) + Number(b.dataset.d)); M.querySelector(`input[data-k="${b.dataset.k}"][data-p="${b.dataset.p}"]`).value = d.items[b.dataset.p]; });
    M.querySelectorAll('.qty input').forEach(i => i.oninput = () => drafts[i.dataset.k].items[i.dataset.p] = Number(i.value.replace(/[,،\s]/g, '').replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x))) || 0);
    M.querySelectorAll('[data-note]').forEach(i => i.oninput = () => drafts[i.dataset.note].note = i.value);
    $('#dcancel').onclick = () => modal('');
    $('#dsave').onclick = async () => {
      if (drafts.some(d => !d.restaurant_id)) return toast('اختر اسم المطعم');
      try {
        for (const d of drafts) {
          const items = { ...d.items }; const ex = existing[d.restaurant_id + date];
          if (ex && d.add) ex.items.forEach(i => items[i.product_id] = (Number(items[i.product_id]) || 0) + i.qty);
          await api('/api/m/order', { restaurant_id: d.restaurant_id, delivery_date: date, items: Object.entries(items).map(([product_id, qty]) => ({ product_id, qty })), note: d.note || (ex ? ex.note : '') });
        }
        modal(''); toast('تم حفظ الطلبية ✅'); dayDate = date; location.hash = '#/day'; dayView();
      } catch (e) { toast(e.message); }
    };
  }
  render();
}

// ================= خط التوصيل =================
async function routeView() {
  const D = await api('/api/m/day?date=' + dayDate);
  const list = D.orders.filter(o => o.status !== 'cancelled');
  const left = list.filter(o => o.status !== 'delivered').length;
  app.innerHTML = `${dateBar(D.date, 'rb')}
  ${list.length ? `<div class="card" id="mapcard"><div id="map" style="height:300px;border-radius:12px;background:#e8e8e8"></div><div id="mapnote" class="mut" style="margin-top:6px"></div><div id="gdir"></div></div>` : ''}
  <div class="card center" style="font-size:20px">${list.length ? (left ? `باقي <b>${left}</b> من ${list.length} توصيلات` : '✅ تم توصيل كل الطلبيات') : 'لا يوجد توصيلات لهذا اليوم'}</div>
  ${list.map((o, k) => `<div class="card" style="${o.status === 'delivered' ? 'opacity:.6' : ''}">
    <div class="row"><b style="font-size:24px;flex:0 0 44px;color:var(--g)">${k + 1}.</b><div style="flex:5"><b style="font-size:21px">${esc(o.restaurant_name)}</b><div class="mut">${esc(o.address || '')}</div></div>
      <div style="flex:0 0 auto;display:flex;flex-direction:column;gap:4px"><button class="btn sec sm" data-mv="-1" data-k="${k}" ${k === 0 ? 'disabled' : ''}>▲</button><button class="btn sec sm" data-mv="1" data-k="${k}" ${k === list.length - 1 ? 'disabled' : ''}>▼</button></div></div>
    <ul class="items">${o.items.map(i => `<li><span>${esc(i.name)}</span><b>${num(i.qty)} ${esc(i.unit)}</b></li>`).join('')}</ul>
    <div class="row">${o.phone ? `<a class="btn sec sm" href="${telLink(o.phone)}">📞 اتصال</a>` : ''}${mapLink(o) ? `<a class="btn sec sm" target="_blank" rel="noopener" href="${esc(mapLink(o))}">🗺️ الخريطة</a>` : ''}</div>
    <div style="margin-top:8px">${o.status === 'delivered' ? `<button class="btn sec block" data-st="new" data-id="${o.id}">✅ تم التوصيل — تراجع</button>` : `<button class="btn block" style="min-height:64px" data-st="delivered" data-id="${o.id}">🚚 تم التوصيل</button>`}</div>
  </div>`).join('')}
  <p class="mut center">الترتيب (▲▼) يُحفظ ويُستخدم كل يوم</p>`;
  bindDateBar('rb', routeView);
  if (list.length) showRouteMap(list);
  app.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { await api(`/api/m/orders/${b.dataset.id}/status`, { status: b.dataset.st }); toast('تم ✅'); routeView(); });
  app.querySelectorAll('[data-mv]').forEach(b => b.onclick = async () => {
    const k = Number(b.dataset.k), j = k + Number(b.dataset.mv);
    // full route order: all restaurants, swap the two
    const ids = L.restaurants.map(r => r.id);
    const a = list[k].restaurant_id, c = list[j].restaurant_id, ia = ids.indexOf(a), ic = ids.indexOf(c);
    ids[ia] = c; ids[ic] = a;
    await api('/api/m/route', { ids }); L = await api('/api/m/lookups'); routeView();
  });
}

// خريطة خط التوصيل (Leaflet + OpenStreetMap) — تحتاج إنترنت لتحميل الخريطة
function loadLeaflet() {
  if (window.L_) return Promise.resolve(window.L_);
  return new Promise((res, rej) => {
    const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(c);
    const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => { window.L_ = window.L.noConflict ? window.L.noConflict() : window.L; res(window.L_); }; s.onerror = rej; document.head.appendChild(s);
  });
}
async function showRouteMap(list) {
  const pts = list.map((o, k) => ({ o, k })).filter(x => x.o.lat != null && x.o.lng != null);
  const miss = list.length - pts.length;
  $('#mapnote').textContent = miss ? `${miss} زبون بدون موقع — افتح «الزبائن ← تعديل ← 📍 موقعي الحالي» وأنت عند المطعم` : '';
  const todo = pts.filter(x => x.o.status !== 'delivered');
  if (todo.length) { const c = x => `${x.o.lat},${x.o.lng}`, last = todo[todo.length - 1], mid = todo.slice(0, -1).slice(0, 9);
    $('#gdir').innerHTML = `<a class="btn blue block" style="margin-top:8px" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${c(last)}${mid.length ? '&waypoints=' + encodeURIComponent(mid.map(c).join('|')) : ''}">🧭 ابدأ المشوار في خرائط Google</a>`; }
  if (!pts.length) { $('#map').style.display = 'none'; return; }
  let Lf; try { Lf = await loadLeaflet(); } catch (e) { $('#map').innerHTML = '<div class="center mut" style="padding:40px 10px">الخريطة بدها إنترنت</div>'; return; }
  if (!$('#map')) return;
  const m = Lf.map('map', { zoomControl: true, attributionControl: true });
  Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const ll = pts.map(x => [x.o.lat, x.o.lng]);
  pts.forEach(x => Lf.marker([x.o.lat, x.o.lng], { icon: Lf.divIcon({ className: 'pin' + (x.o.status === 'delivered' ? ' done' : ''), html: String(x.k + 1), iconSize: [34, 34] }) }).addTo(m).bindPopup(esc(x.o.restaurant_name)));
  if (ll.length > 1) Lf.polyline(ll, { color: '#2f6b3a', weight: 4, opacity: .7 }).addTo(m);
  m.fitBounds(ll, { padding: [30, 30], maxZoom: 15 });
}

// ================= ورقة اليوم (طباعة/مشاركة) =================
async function printView(date) {
  const D = await api('/api/m/day?date=' + (date || dayDate));
  const st = await api('/api/m/settings');
  const list = D.orders.filter(o => o.status !== 'cancelled');
  const text = `*${st.factory_name}* — طلبيات ${fmtDate(D.date)}\n\n*المطلوب تحضيره:*\n${D.totals.map(t => `• ${t.name}: ${num(t.qty)} ${t.unit}`).join('\n')}\n\n*التوصيل:*\n${list.map((o, k) => `${k + 1}. ${o.restaurant_name}${o.phone ? ' (' + o.phone + ')' : ''}\n   ${o.items.map(i => `${i.name} ${num(i.qty)} ${i.unit}`).join('، ')}${o.note ? '\n   ملاحظة: ' + o.note : ''}`).join('\n')}`;
  app.innerHTML = `<div class="row no-print" style="margin-bottom:12px"><button class="btn" onclick="print()">🖨️ طباعة</button><a class="btn sec" target="_blank" rel="noopener" href="${waShare(text)}">📤 واتساب</a>${navigator.share ? '<button class="btn blue" id="share">مشاركة</button>' : ''}</div>
  <div class="card"><h2 style="margin-top:0">${esc(st.factory_name)}</h2><div style="font-size:20px">ورقة التحضير والتوصيل — <b>${fmtDate(D.date)}</b></div></div>
  <div class="card"><h2 style="margin-top:0">المطلوب تحضيره</h2><table><tr><th>الصنف</th><th>الكمية</th></tr>${D.totals.map(t => `<tr><td>${esc(t.name)}</td><td><b>${num(t.qty)} ${esc(t.unit)}</b></td></tr>`).join('')}</table></div>
  <div class="card"><h2 style="margin-top:0">خط التوصيل</h2><table><tr><th>#</th><th>المطعم</th><th>الطلب</th><th>✔</th></tr>
  ${list.map((o, k) => `<tr><td>${k + 1}</td><td><b>${esc(o.restaurant_name)}</b><br><small>${esc(o.phone || '')} ${esc(o.address || '')}</small></td><td>${o.items.map(i => `${esc(i.name)}: ${num(i.qty)} ${esc(i.unit)}`).join('<br>')}${o.note ? `<br><small>📝 ${esc(o.note)}</small>` : ''}</td><td style="width:40px">☐</td></tr>`).join('')}</table></div>`;
  try { const F = await api('/api/m/forecast?date=' + D.date); if (F.needs.length) app.insertAdjacentHTML('beforeend', `<div class="card"><h2 style="margin-top:0">المواد الخام المطلوبة</h2>${needsHtml(F)}</div>`); } catch (e) {}
  const sh = $('#share'); if (sh) sh.onclick = () => navigator.share({ title: 'طلبيات ' + D.date, text }).catch(() => {});
}

// ================= السجل =================
async function historyView() {
  const H = await api('/api/m/history');
  app.innerHTML = `<h2>سجل الأيام</h2>${H.map(h => `<a class="card row" style="text-decoration:none;color:inherit" href="#/day" data-d="${h.date}"><div><b>${fmtDate(h.date)}</b><div class="mut">${h.orders} طلبيات • تم توصيل ${h.delivered}</div></div><div style="flex:0 0 auto" class="money">${sar(h.total || 0)}</div></a>`).join('') || '<div class="card mut">لا يوجد</div>'}`;
  app.querySelectorAll('[data-d]').forEach(a => a.onclick = () => { dayDate = a.dataset.d; });
}

// ================= الحسابات =================
async function moneyView() {
  const month = L.today.slice(0, 7);
  const [B, S] = await Promise.all([api('/api/m/finance/balances'), api('/api/m/finance/summary?month=' + month)]);
  const td = S.days.find(d => d.date === L.today) || { sales: 0, collected: 0, expenses: 0 };
  app.innerHTML = `
  <div class="grid2"><button class="btn" id="pay">💵 استلام دفعة</button><a class="btn warn" href="#/expenses">🧾 المصاريف</a></div>
  <h2>الديون على المطاعم</h2>
  <div class="total" style="border-color:var(--red)"><span class="n">المجموع</span><span class="q" style="color:var(--red)">${sar(B.total_outstanding)}</span></div>
  ${B.rows.map(r => `<a class="card row" style="text-decoration:none;color:inherit" href="#/statement/${r.id}"><div><b>${esc(r.name)}</b><div class="mut">مبيعات ${sar(r.sales)} • مدفوع ${sar(r.paid)}</div></div><div style="flex:0 0 auto" class="money ${r.balance > 0 ? 'pos' : 'neg'}">${r.balance >= 0 ? sar(r.balance) : 'له ' + sar(-r.balance)}</div></a>`).join('')}
  <h2>اليوم</h2>
  <div class="card"><ul class="items"><li><span>مبيعات (تم توصيلها)</span><b>${sar(td.sales)}</b></li><li><span>تحصيل</span><b>${sar(td.collected)}</b></li><li><span>مصاريف</span><b>${sar(td.expenses)}</b></li></ul></div>
  <h2>هذا الشهر (${month})</h2>
  <div class="card"><ul class="items"><li><span>مبيعات</span><b>${sar(S.sales)}</b></li><li><span>تحصيل</span><b>${sar(S.collected)}</b></li><li><span>مصاريف</span><b>${sar(S.expenses)}</b></li><li><span>الربح التقريبي (مبيعات − مصاريف)</span><b class="${S.profit >= 0 ? 'neg' : 'pos'}">${sar(S.profit)}</b></li></ul>
   ${S.by_category.length ? `<div class="mut" style="margin-top:8px">المصاريف: ${S.by_category.map(c => `${esc(c.category)} ${sar(c.amount)}`).join(' • ')}</div>` : ''}</div>
  ${B.supplier_total ? `<h2>علينا للموردين</h2><div class="card"><ul class="items">${B.supplier_debts.map(s => `<li><span>${esc(s.supplier || 'بدون اسم')}</span><b class="pos">${sar(s.amount)}</b></li>`).join('')}<li><span>المجموع</span><b class="pos">${sar(B.supplier_total)}</b></li></ul></div>` : ''}
  <h2>حسب الأيام</h2><div class="card"><table><tr><th>اليوم</th><th>مبيعات</th><th>تحصيل</th><th>مصاريف</th></tr>${S.days.map(d => `<tr><td>${d.date.slice(5)}</td><td>${num(d.sales)}</td><td>${num(d.collected)}</td><td>${num(d.expenses)}</td></tr>`).join('')}</table></div>`;
  $('#pay').onclick = () => paymentForm();
}
function paymentForm(rid) {
  modal(`<h2 style="margin-top:0">💵 استلام دفعة</h2>
   <label>من مطعم</label><select id="p_r"><option value="">— اختر —</option>${L.restaurants.map(r => `<option value="${r.id}" ${r.id == rid ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
   <label>المبلغ (ريال)</label><input id="p_a" inputmode="decimal">
   <label>الطريقة</label><div class="row"><button class="btn sm" data-m="نقدي">نقدي</button><button class="btn sec sm" data-m="تحويل">تحويل</button></div>
   <label>التاريخ</label><input id="p_d" type="date" value="${L.today}">
   <label>ملاحظة</label><input id="p_n">
   <div style="height:12px"></div><button class="btn block" id="p_s">حفظ</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
  let method = 'نقدي';
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { method = b.dataset.m; document.querySelectorAll('[data-m]').forEach(x => x.className = 'btn sm ' + (x === b ? '' : 'sec')); });
  $('#p_s').onclick = async () => { if (!$('#p_r').value) return toast('اختر المطعم'); try { await api('/api/m/finance/payments', { restaurant_id: $('#p_r').value, amount: $('#p_a').value, method, date: $('#p_d').value, note: $('#p_n').value }); modal(''); toast('تم تسجيل الدفعة ✅'); route(); } catch (e) { toast(e.message); } };
}
async function statementView(rid) {
  const from = sessionStorage.st_from || addDays(L.today, -30), to = sessionStorage.st_to || L.today;
  const S = await api(`/api/m/finance/statement?restaurant_id=${rid}&from=${from}&to=${to}`);
  const text = `*${S.factory_name}* — كشف حساب\n${S.restaurant.name}\nمن ${S.from} إلى ${S.to}\n\nرصيد سابق: ${num(S.opening)} ريال\n${S.lines.map(l => `${l.date} | ${l.kind === 'order' ? 'طلبية ' + num(l.debit) : 'دفعة ' + num(l.credit)} | الرصيد ${num(l.balance)}`).join('\n')}\n\n*المبلغ المستحق: ${num(S.closing)} ريال*`;
  app.innerHTML = `<div class="no-print"><div class="grid2"><div><label>من</label><input type="date" id="sf" value="${S.from}"></div><div><label>إلى</label><input type="date" id="stt" value="${S.to}"></div></div>
   <div class="row" style="margin:12px 0"><button class="btn" onclick="print()">🖨️ طباعة</button><a class="btn sec" target="_blank" rel="noopener" href="${waShare(text)}">📤 واتساب</a><button class="btn warn" id="spay">💵 دفعة</button></div></div>
  <div class="card"><h2 style="margin-top:0">كشف حساب — ${esc(S.restaurant.name)}</h2><div class="mut">${esc(S.factory_name)} • من ${fmtDate(S.from)} إلى ${fmtDate(S.to)}</div></div>
  <div class="card"><table><tr><th>التاريخ</th><th>البيان</th><th>عليه</th><th>دفع</th><th>الرصيد</th></tr>
   <tr><td colspan="4">رصيد سابق</td><td><b>${num(S.opening)}</b></td></tr>
   ${S.lines.map(l => `<tr><td>${l.date.slice(5)}</td><td>${esc(l.desc)}</td><td>${l.debit ? num(l.debit) : ''}</td><td>${l.credit ? num(l.credit) : ''}${l.id ? ` <button class="no-print" data-del="${l.id}" style="border:0;background:none;color:var(--red)">✕</button>` : ''}</td><td><b>${num(l.balance)}</b></td></tr>`).join('')}</table></div>
  <div class="total" style="border-color:var(--red)"><span class="n">المبلغ المستحق</span><span class="q" style="color:var(--red)">${sar(S.closing)}</span></div>`;
  const upd = () => { sessionStorage.st_from = $('#sf').value; sessionStorage.st_to = $('#stt').value; statementView(rid); };
  $('#sf').onchange = upd; $('#stt').onchange = upd; $('#spay').onclick = () => paymentForm(rid);
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('حذف هذه الدفعة؟')) return; await api('/api/m/finance/payments/' + b.dataset.del, null, 'DELETE'); statementView(rid); });
}
async function expensesView() {
  const month = sessionStorage.ex_month || L.today.slice(0, 7);
  const E = await api('/api/m/finance/expenses?month=' + month);
  app.innerHTML = `<button class="btn block" id="eadd">➕ مصروف جديد</button>
  <label>الشهر</label><input type="month" id="em" value="${month}">
  <div class="total"><span class="n">مجموع الشهر</span><span class="q">${sar(E.reduce((s, e) => s + e.amount, 0))}</span></div>
  ${E.map(e => `<div class="card" data-e="${e.id}"><div class="row"><div><b>${esc(e.category)}</b> ${e.supplier ? `<span class="mut">• ${esc(e.supplier)}</span>` : ''}<div class="mut">${fmtDate(e.date)}${e.note ? ' • ' + esc(e.note) : ''}</div></div><div style="flex:0 0 auto;text-align:left"><b class="money">${sar(e.amount)}</b><br>${e.paid ? '<span class="badge st-delivered">مدفوع</span>' : '<span class="badge st-new">دين علينا</span>'}</div></div></div>`).join('') || '<div class="card mut">لا يوجد مصاريف</div>'}`;
  $('#em').onchange = () => { sessionStorage.ex_month = $('#em').value; expensesView(); };
  $('#eadd').onclick = () => expenseForm({});
  app.querySelectorAll('[data-e]').forEach(c => c.onclick = () => expenseForm(E.find(e => e.id == c.dataset.e)));
}
function expenseForm(e) {
  const cats = ['مواد خام', 'رواتب', 'توصيل', 'إيجار', 'كهرباء وماء', 'أخرى'];
  modal(`<h2 style="margin-top:0">${e.id ? 'تعديل مصروف' : 'مصروف جديد'}</h2>
   <label>النوع</label><select id="e_c">${cats.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
   <label>المبلغ (ريال)</label><input id="e_a" inputmode="decimal" value="${e.amount || ''}">
   <label>التاريخ</label><input id="e_d" type="date" value="${e.date || L.today}">
   <label>المورد (اختياري)</label><input id="e_s" value="${esc(e.supplier || '')}">
   <label style="display:flex;gap:10px;align-items:center;font-size:19px;color:inherit"><input type="checkbox" id="e_p" style="width:28px;height:28px" ${e.id && !e.paid ? 'checked' : ''}> لسا ما دفعناه (دين علينا للمورد)</label>
   <label>ملاحظة</label><input id="e_n" value="${esc(e.note || '')}">
   <div style="height:12px"></div><button class="btn block" id="e_save">حفظ</button>
   ${e.id ? '<button class="btn red block" style="margin-top:8px" id="e_del">حذف</button>' : ''}
   <button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
  $('#e_save').onclick = async () => { try { await api('/api/m/finance/expenses', { id: e.id, category: $('#e_c').value, amount: $('#e_a').value, date: $('#e_d').value, supplier: $('#e_s').value, paid: !$('#e_p').checked, note: $('#e_n').value }); modal(''); toast('تم الحفظ ✅'); expensesView(); } catch (x) { toast(x.message); } };
  if (e.id) $('#e_del').onclick = async () => { if (!confirm('حذف المصروف؟')) return; await api('/api/m/finance/expenses/' + e.id, null, 'DELETE'); modal(''); expensesView(); };
}

// ================= الزبائن =================
async function customersView() {
  const days = Number(sessionStorage.stop_days || (await api('/api/m/settings')).stop_days || 7);
  const [R, St] = await Promise.all([api('/api/m/restaurants'), api('/api/m/stopped?days=' + days)]);
  app.innerHTML = `<button class="btn block" id="radd">➕ زبون جديد</button>
  <h2>⚠️ وقفوا عن الطلب</h2>
  <div class="card"><div class="row"><span>بدون طلب من</span><select id="sd" style="flex:0 0 110px">${[3, 7, 14, 30].map(d => `<option value="${d}" ${d === days ? 'selected' : ''}>${d} أيام</option>`).join('')}</select></div>
   ${St.rows.length ? St.rows.map(r => `<div class="row" style="margin-top:10px;border-top:1px solid #eee;padding-top:10px"><div><b>${esc(r.name)}</b><div class="mut">${r.last_order ? `آخر طلب قبل ${r.days_since} يوم` : 'لم يطلب بعد'}</div></div>${r.phone ? `<a class="btn sec sm" style="flex:0 0 auto" href="${telLink(r.phone)}">📞 اتصال</a>` : ''}</div>`).join('') : '<div class="mut" style="margin-top:8px">كل الزبائن النشطين طلبوا مؤخراً 👍</div>'}</div>
  <h2>كل الزبائن (${R.length})</h2>
  ${R.map(r => `<div class="card" style="${r.active ? '' : 'opacity:.7'}"><div class="row"><div><b style="font-size:21px">${esc(r.name)}</b> ${r.active ? '' : '<span class="badge st-paused">موقوف</span>'}
     <div class="mut">${esc(r.phone || '')} ${r.address ? '• ' + esc(r.address) : ''}</div>
     <div class="mut">${r.last_order ? 'آخر طلب: ' + r.last_order : 'لا يوجد طلبات'} • الرصيد: <b class="${r.balance > 0 ? 'pos' : ''}">${sar(r.balance)}</b></div></div></div>
     <div class="row" style="margin-top:8px"><button class="btn sec sm" data-ed="${r.id}">✏️ تعديل</button><button class="btn ${r.active ? 'warn' : ''} sm" data-act="${r.id}" data-v="${r.active ? 0 : 1}">${r.active ? '⏸ إيقاف' : '▶ إعادة تفعيل'}</button><a class="btn sec sm" href="#/statement/${r.id}">📄 كشف</a></div></div>`).join('')}`;
  $('#sd').onchange = () => { sessionStorage.stop_days = $('#sd').value; customersView(); };
  $('#radd').onclick = () => restaurantForm({ active: 1 });
  app.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => restaurantForm(R.find(r => r.id == b.dataset.ed)));
  app.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { await api(`/api/m/restaurants/${b.dataset.act}/active`, { active: b.dataset.v === '1' }); L = await api('/api/m/lookups'); toast('تم ✅'); customersView(); });
}
function restaurantForm(r) {
  r = { ...r };
  setTimeout(() => { const g = $('#r_gps'); if (g) g.onclick = () => {
    if (!navigator.geolocation) return toast('الجهاز ما بيدعم تحديد الموقع');
    $('#r_ll').textContent = '⏳ جاري تحديد الموقع…';
    navigator.geolocation.getCurrentPosition(p => { r.lat = Math.round(p.coords.latitude * 1e6) / 1e6; r.lng = Math.round(p.coords.longitude * 1e6) / 1e6; $('#r_ll').textContent = '✅ تم أخذ الموقع، اضغط حفظ'; },
      e => { $('#r_ll').textContent = e.code === 1 ? 'اسمح للتطبيق باستخدام الموقع' : 'ما قدرت أحدد الموقع'; }, { enableHighAccuracy: true, timeout: 20000 });
  }; }, 0);
  modal(`<h2 style="margin-top:0">${r.id ? 'تعديل زبون' : 'زبون جديد'}</h2>
   <label>اسم المطعم</label><input id="r_n" value="${esc(r.name || '')}">
   <label>رقم الجوال</label><input id="r_p" inputmode="tel" value="${esc(r.phone || '')}">
   <label>العنوان</label><input id="r_a" value="${esc(r.address || '')}">
   <label>رابط الموقع على الخريطة (اختياري)</label><input id="r_m" dir="ltr" value="${esc(r.map_url || '')}" placeholder="https://maps.google.com/...">
   <label>الموقع على الخريطة</label><div class="row"><button type="button" class="btn sec sm" id="r_gps">📍 موقعي الحالي</button><span id="r_ll" class="mut" style="flex:2">${r.lat != null ? '✅ الموقع محفوظ' : 'لما تكون عند المطعم اضغط الزر'}</span></div>
   <div style="height:12px"></div><button class="btn block" id="r_s">حفظ</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
  $('#r_s').onclick = async () => { try { await api('/api/m/restaurants', { id: r.id, name: $('#r_n').value, phone: $('#r_p').value, address: $('#r_a').value, map_url: $('#r_m').value, lat: r.lat, lng: r.lng, active: r.active ? 1 : 0 }); L = await api('/api/m/lookups'); modal(''); toast('تم الحفظ ✅'); customersView(); } catch (e) { toast(e.message); } };
}

// ================= المزيد =================
async function moreView() {
  const S = await api('/api/m/settings');
  app.innerHTML = `<div class="card"><h2 style="margin-top:0">💾 حفظ البيانات</h2>
   <p class="mut" style="margin-top:0">كل البيانات محفوظة على هذا الجوال فقط. اعمل نسخة احتياطية كل أسبوع واحفظها في «الملفات» أو أرسلها لنفسك على واتساب.</p>
   <button class="btn block" id="bk" style="min-height:72px;font-size:22px">💾 نسخ احتياطي</button>
   <button class="btn sec block" id="rs" style="min-height:72px;font-size:22px;margin-top:10px">♻️ استعادة</button>
   <div class="mut center" style="margin-top:8px">${S.last_backup ? 'آخر نسخة: ' + fmtDate(S.last_backup.slice(0, 10)) : 'لسا ما في نسخة احتياطية'}</div></div>
  <div style="display:grid;gap:12px">
   <a class="btn block sec" href="#/products">🥬 الأصناف والأسعار والوصفات</a>
   <a class="btn block sec" href="#/stock">📦 المخزون (${esc(AVATAR_NAME)} بيراقبه)</a>
   <a class="btn block sec" href="#/ingredients">🧂 المواد الخام وأسعارها</a>
   <a class="btn block sec" href="#/needs/${addDays(L.today, 1)}">📦 المواد المطلوبة لبكرة</a>
   <a class="btn block sec" href="#/history">📅 سجل الأيام</a>
   <a class="btn block sec" href="#/print/${dayDate}">🖨️ ورقة اليوم</a>
   <a class="btn block sec" href="#/expenses">🧾 المصاريف</a>
   <a class="btn block sec" href="#/settings">⚙️ الإعدادات</a></div>`;
  $('#bk').onclick = () => doBackup(moreView); $('#rs').onclick = doRestore;
}

// ================= نسخ احتياطي واستعادة =================
// ملف JSON عبر نافذة المشاركة في iPhone (حفظ في الملفات / واتساب)، وإذا ما انفتحت: تنزيل الملف
async function doBackup(after) {
  let json; try { json = Store.exportJson(); } catch (e) { return toast(e.message); }
  const name = `talabiyat-backup-${Store.today()}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  let file = null; try { file = new File([blob], name, { type: 'application/json' }); } catch (_) {}
  let ok = false;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'نسخة احتياطية - طلبيات' }); ok = true; }
    catch (e) { if (e && e.name === 'AbortError') return toast('ما تم حفظ النسخة'); }
  }
  if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); ok = true; }
  await api('/api/m/backup-done', {}); toast('تم النسخ الاحتياطي ✅'); if (after) after();
}
function doRestore() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json,text/plain'; inp.id = 'restore_file'; inp.style.display = 'none';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
    let d; try { d = JSON.parse(await f.text()); } catch (e) { return toast('الملف مش صحيح'); }
    if (!d || d.app !== 'talabiyat') return toast('الملف مش نسخة احتياطية من طلبيات');
    const when = d.exported_at ? fmtDate(String(d.exported_at).slice(0, 10)) : '';
    if (!confirm(`استعادة النسخة ${when}؟\n(${(d.restaurants || []).length} زبون، ${(d.orders || []).length} طلبية، ${(d.payments || []).length} دفعة)\n\nتنبيه: البيانات الحالية على الجوال رح تنمسح وتنحط مكانها النسخة. الرقم السري الحالي بيضل نفسه.`)) return;
    try { await api('/api/m/restore', { data: d }); toast('تمت الاستعادة ✅'); setTimeout(() => location.reload(), 600); } catch (e) { toast(e.message); }
  };
  document.body.appendChild(inp); inp.click();
}
async function productsView() {
  const P = await api('/api/m/recipes');
  app.innerHTML = `<button class="btn block" id="padd">➕ صنف جديد</button><div style="height:12px"></div>
  ${P.map(p => `<div class="card" data-p="${p.id}" style="${p.active ? '' : 'opacity:.6'}"><div class="row"><div><b style="font-size:21px">${esc(p.name)}</b> ${p.active ? '' : '<span class="badge st-paused">مخفي</span>'}<div class="mut">الوحدة: ${esc(p.unit)}</div></div><b style="flex:0 0 auto" class="money">${sar(p.price)} / ${esc(p.unit)}</b></div>
    <div class="kv"><span>تكلفة ال${esc(p.unit)} (من الوصفة)</span><b>${p.lines.length ? sar(p.cost_per_unit) : '— بدون وصفة'}</b></div>
    ${p.lines.length ? `<div class="kv"><span>ربح ال${esc(p.unit)}</span><b style="color:${p.margin_per_unit >= 0 ? 'var(--g)' : 'var(--red)'}">${sar(p.margin_per_unit)}${p.price ? ` (${Math.round(p.margin_per_unit / p.price * 100)}٪)` : ''}</b></div>
    <div class="mut" style="font-size:15px;margin-top:4px">${p.lines.map(l => `${esc(l.name)} ${num(l.qty)} ${esc(l.unit)}`).join(' • ')}</div>` : ''}
    <div class="grid2" style="margin-top:8px"><button class="btn sec sm" data-edit="${p.id}">✏️ الصنف والسعر</button><button class="btn sec sm" data-rec="${p.id}">🧪 الوصفة</button></div></div>`).join('')}
  <p class="mut">السعر موحّد لكل المطاعم، ويُستخدم لحساب الديون. تغيير السعر يطبَّق على الطلبيات الجديدة فقط. الوصفة = كمية كل مادة خام لكل ${'حبة'} واحدة.</p>`;
  $('#padd').onclick = () => productForm({ unit: 'حبة', active: 1 });
  app.querySelectorAll('[data-edit]').forEach(c => c.onclick = () => productForm(P.find(p => p.id == c.dataset.edit)));
  app.querySelectorAll('[data-rec]').forEach(c => c.onclick = () => recipeForm(P.find(p => p.id == c.dataset.rec)));
}
async function recipeForm(p) {
  const ING = (await api('/api/m/ingredients')).filter(i => i.active);
  let lines = p.lines.map(l => ({ ingredient_id: l.ingredient_id, qty: l.qty, unit: l.unit }));
  const U = ['غرام', 'كغ', 'مل', 'لتر', 'حبة'];
  function render() {
    modal(`<h2 style="margin-top:0">وصفة ${esc(p.name)}</h2><div class="mut">الكميات لكل <b>${esc(p.unit)} واحدة</b></div>
     ${lines.map((l, k) => `<div class="row" style="margin-top:10px;gap:6px"><select data-i="${k}" style="flex:2">${ING.map(i => `<option value="${i.id}" ${i.id == l.ingredient_id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>
       <input data-q="${k}" inputmode="decimal" value="${l.qty}" style="flex:1;text-align:center"><select data-u="${k}" style="flex:1">${U.map(u => `<option ${u === l.unit ? 'selected' : ''}>${u}</option>`).join('')}</select><button class="btn sec sm" data-x="${k}" style="flex:0 0 48px">✕</button></div>`).join('')}
     ${ING.length ? '<button class="btn sec sm block" id="r_add" style="margin-top:10px">➕ مادة</button>' : '<div class="sample">أضف المواد الخام أولاً من «المزيد ← المواد الخام»</div>'}
     <div style="height:12px"></div><button class="btn block" id="r_s">حفظ الوصفة</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
    const M = $('#modal');
    M.querySelectorAll('[data-i]').forEach(e => e.onchange = () => lines[e.dataset.i].ingredient_id = Number(e.value));
    M.querySelectorAll('[data-q]').forEach(e => e.oninput = () => lines[e.dataset.q].qty = Number(e.value.replace(',', '.')) || 0);
    M.querySelectorAll('[data-u]').forEach(e => e.onchange = () => lines[e.dataset.u].unit = e.value);
    M.querySelectorAll('[data-x]').forEach(e => e.onclick = () => { lines.splice(e.dataset.x, 1); render(); });
    const a = $('#r_add'); if (a) a.onclick = () => { lines.push({ ingredient_id: ING[0].id, qty: 0, unit: 'غرام' }); render(); };
    $('#r_s').onclick = async () => { try { await api('/api/m/recipes/' + p.id, { lines }); modal(''); toast('تم الحفظ ✅'); productsView(); } catch (e) { toast(e.message); } };
  }
  render();
}
async function ingredientsView() {
  const I = await api('/api/m/ingredients');
  app.innerHTML = `<button class="btn block" id="iadd">➕ مادة خام جديدة</button><div style="height:12px"></div>
  ${I.map(i => `<div class="card row" data-i="${i.id}" style="${i.active ? '' : 'opacity:.6'}"><b style="font-size:20px">${esc(i.name)}</b><b class="money" style="flex:0 0 auto">${sar(i.cost)} / ${esc(i.unit)}</b></div>`).join('') || '<div class="card mut">لا يوجد</div>'}
  <p class="mut">سعر الشراء يُستخدم لحساب تكلفة الحبة والمواد المطلوبة لكل يوم.</p>`;
  const form = i => {
    modal(`<h2 style="margin-top:0">${i.id ? 'تعديل مادة' : 'مادة جديدة'}</h2><label>الاسم</label><input id="i_n" value="${esc(i.name || '')}">
     <label>وحدة الشراء</label><select id="i_u">${['كغ', 'لتر', 'حبة'].map(u => `<option ${u === i.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
     <label>سعر الشراء (ريال لكل وحدة)</label><input id="i_c" inputmode="decimal" value="${i.cost ?? ''}">
     <label style="display:flex;gap:10px;align-items:center;font-size:19px;color:inherit"><input type="checkbox" id="i_a" style="width:28px;height:28px" ${i.active !== 0 ? 'checked' : ''}> مستخدمة</label>
     <div style="height:12px"></div><button class="btn block" id="i_s">حفظ</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
    $('#i_s').onclick = async () => { try { await api('/api/m/ingredients', { id: i.id, name: $('#i_n').value, unit: $('#i_u').value, cost: $('#i_c').value, active: $('#i_a').checked }); modal(''); toast('تم الحفظ ✅'); ingredientsView(); } catch (e) { toast(e.message); } };
  };
  $('#iadd').onclick = () => form({ unit: 'كغ', active: 1 });
  app.querySelectorAll('[data-i]').forEach(c => c.onclick = () => form(I.find(x => x.id == c.dataset.i)));
}
// كمية مادة خام بشكل مقروء (أقل من 1 كغ ← غرام)
const amt = (a, u) => u === 'كغ' && a < 1 ? `${num(Math.round(a * 1000))} غرام` : u === 'لتر' && a < 1 ? `${num(Math.round(a * 1000))} مل` : `${num(Math.round(a * 10) / 10)} ${u}`;
const needsHtml = F => `<table><tr><th>المادة</th><th>الكمية</th><th>التكلفة</th></tr>${F.needs.map(n => `<tr><td>${esc(n.name)}</td><td><b>${amt(n.amount, n.unit)}</b></td><td>${sar(n.cost)}</td></tr>`).join('')}</table>`;
async function needsView(date) {
  if (date) dayDate = date;
  const F = await api('/api/m/forecast?date=' + dayDate);
  app.innerHTML = `${dateBar(F.date, 'nb')}
  <div class="card"><h2 style="margin-top:0">📦 المواد الخام المطلوبة</h2>${F.needs.length ? needsHtml(F) : '<div class="mut">لا يوجد طلبات (أو لا يوجد وصفات) لهذا اليوم</div>'}</div>
  <div class="card"><h2 style="margin-top:0">💰 تكلفة وربح اليوم (تقديري)</h2>
   ${F.products.map(p => `<div class="kv"><span>${esc(p.name)}: ${num(p.qty)} ${esc(p.unit)}</span><span>تكلفة ${sar(p.qty * p.cost_per_unit)}</span></div>`).join('')}
   <div class="kv"><span>قيمة المبيعات</span><b>${sar(F.sales_value)}</b></div><div class="kv"><span>تكلفة المواد</span><b>${sar(F.production_cost)}</b></div>
   <div class="kv"><span>الربح قبل الرواتب والمصاريف</span><b style="color:var(--g)">${sar(F.profit)}</b></div></div>
  <div class="card"><h2 style="margin-top:0">📈 توقّع الكميات</h2><div class="mut">متوسط نفس اليوم في آخر 4 أسابيع (للأيام اللي فيها طلبات)</div>
   ${F.suggestions.map(s => `<div class="kv"><span>${esc(s.name)}</span><span>${s.weeks ? `متوقع ~${num(s.avg)} ${esc(s.unit)}` : 'لا يوجد بيانات كافية'} • مطلوب ${num(s.ordered)}</span></div>`).join('')}</div>`;
  bindDateBar('nb', () => { location.hash = '#/needs/' + dayDate; });
}
function productForm(p) {
  modal(`<h2 style="margin-top:0">${p.id ? 'تعديل صنف' : 'صنف جديد'}</h2>
   <label>اسم الصنف</label><input id="p_n" value="${esc(p.name || '')}">
   <label>الوحدة</label><select id="p_u">${['حبة', 'صينية', 'علبة', 'طبق', 'كغ'].map(u => `<option ${u === p.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
   <label>السعر (ريال لكل ${esc(p.unit || 'حبة')}) — نفس السعر لكل المطاعم</label><input id="p_pr" inputmode="decimal" value="${p.price ?? ''}">
   <label style="display:flex;gap:10px;align-items:center;font-size:19px;color:inherit"><input type="checkbox" id="p_a" style="width:28px;height:28px" ${p.active ? 'checked' : ''}> ظاهر في الطلبات</label>
   <div style="height:12px"></div><button class="btn block" id="p_s">حفظ</button><button class="btn sec block" style="margin-top:8px" onclick="modal('')">إلغاء</button>`);
  $('#p_s').onclick = async () => { try { await api('/api/m/products', { id: p.id, name: $('#p_n').value, unit: $('#p_u').value, price: $('#p_pr').value, active: $('#p_a').checked }); L = await api('/api/m/lookups'); modal(''); toast('تم الحفظ ✅'); productsView(); } catch (e) { toast(e.message); } };
}
async function settingsView() {
  const S = await api('/api/m/settings');
  let pers = null; try { pers = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (_) {}
  app.innerHTML = `<div class="card"><label>اسم المعمل (يظهر في الأوراق والكشوفات)</label><input id="s_n" value="${esc(S.factory_name)}">
   <label>تذكير النسخ الاحتياطي</label><select id="s_b">${[[1, 'كل يوم'], [3, 'كل 3 أيام'], [7, 'كل أسبوع'], [0, 'بدون تذكير']].map(([v, t]) => `<option value="${v}" ${Number(S.backup_every) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
   <label>نبّهني عن الزبون اللي وقف عن الطلب بعد</label><select id="s_d">${[3, 7, 14, 30].map(d => `<option value="${d}" ${Number(S.stop_days) === d ? 'selected' : ''}>${d} أيام</option>`).join('')}</select>
   <div style="height:12px"></div><button class="btn block" id="s_s">حفظ</button></div>
   <div class="card"><h2 style="margin-top:0">🔒 تغيير الرقم السري</h2>
   <label>الرقم السري الحالي</label><input id="pw_c" inputmode="numeric" type="password" autocomplete="current-password">
   <label>الرقم الجديد (4–8 أرقام)</label><input id="pw_n" inputmode="numeric" type="password" autocomplete="new-password">
   <label>أعد كتابة الرقم الجديد</label><input id="pw_n2" inputmode="numeric" type="password" autocomplete="new-password">
   <div style="height:12px"></div><button class="btn block" id="pw_s">تغيير الرقم السري</button></div>
   <div class="card mut">📱 البيانات محفوظة على هذا الجوال فقط${pers === true ? ' (محميّة من المسح التلقائي ✅)' : ''}. لو مسحت التطبيق أو بيانات Safari أو غيّرت الجوال، بتحتاج «استعادة» من آخر نسخة احتياطية.
   ${isStandalone() ? '' : '<br><b>⚠️ أنت فاتح التطبيق من المتصفح مش من أيقونة الشاشة الرئيسية.</b>'}</div>`;
  $('#s_s').onclick = async () => { try { await api('/api/m/settings', { factory_name: $('#s_n').value, backup_every: Number($('#s_b').value), stop_days: Number($('#s_d').value) }); toast('تم الحفظ ✅'); } catch (e) { toast(e.message); } };
  bindPinChange();
}
function bindPinChange() {
  $('#pw_s').onclick = async () => {
    const n = $('#pw_n').value.trim(), n2 = $('#pw_n2').value.trim();
    if (!/^\d{4,8}$/.test(n)) return toast('الرقم الجديد لازم يكون من 4 إلى 8 أرقام');
    if (n !== n2) return toast('الرقم الجديد والتأكيد مش متطابقين');
    if (!confirm('أكيد بدك تغيّر الرقم السري؟')) return;
    try { await api('/api/m/pin', { current: $('#pw_c').value.trim(), new_pin: n, confirm: n2 }); ['#pw_c', '#pw_n', '#pw_n2'].forEach(x => $(x).value = ''); toast('تم تغيير الرقم السري ✅ احفظه منيح'); } catch (e) { toast(e.message); }
  };
}
start().catch(e => app.innerHTML = `<div class="card">${esc(e.message)}</div>`);
