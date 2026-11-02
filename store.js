// طلبيات — كل البيانات على الجهاز (IndexedDB). هذا الملف يقوم بدور "الخادم" داخل المتصفح.
(function () {
  const TZ = 'Asia/Riyadh';
  const IDB_NAME = 'talabiyat', IDB_STORE = 'kv';
  const empty = () => ({ app: 'talabiyat', v: 1, seq: {}, settings: { factory_name: 'معمل الأكل البيتي', backup_every: 7, stop_days: 7 },
    products: [], restaurants: [], orders: [], payments: [], expenses: [], ingredients: [], recipe_items: [], stock_moves: [] });
  let DB = null;

  // ---------- IndexedDB ----------
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbGet(k) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
  async function idbPut(k, v) { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function load() {
    if (DB) return DB;
    let d = null;
    try { d = await idbGet('db'); } catch (e) { try { d = JSON.parse(localStorage.getItem('talabiyat_db') || 'null'); } catch (_) {} }
    DB = d && d.app === 'talabiyat' ? normalize(d) : empty();
    if (!d) { addProduct('ورق العنب', 'حبة', 0); addProduct('الملفوف', 'حبة', 0); await save(); }
    return DB;
  }
  async function save() { DB.saved_at = new Date().toISOString(); try { await idbPut('db', DB); } catch (e) { localStorage.setItem('talabiyat_db', JSON.stringify(DB)); } }

  // ---------- helpers ----------
  const nowIso = () => new Date().toISOString();
  function riyadhParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }
  const today = () => riyadhParts().date;
  function addDays(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const nextId = t => (DB.seq[t] = (DB.seq[t] || 0) + 1);
  const byId = (t, id) => DB[t].find(x => x.id === Number(id));
  // ---------- تنظيف البيانات (نسخة احتياطية من ملف خارجي ممكن تكون معدّلة): كل حقل بنوعه الصحيح ----------
  const SAFE_URL = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
  const SCHEMA = {
    products: { id: 'n', name: 's', unit: 's', price: 'n', active: 'b', sort: 'n' },
    restaurants: { id: 'n', name: 's', phone: 's', address: 's', map_url: 'u', lat: 'n?', lng: 'n?', active: 'b', route_order: 'n', sample: 'b', created_at: 's' },
    orders: { id: 'n', restaurant_id: 'n', delivery_date: 'd', status: ['new', 'prepared', 'delivered', 'cancelled'], source: 's', note: 's', created_at: 's', updated_at: 's' },
    payments: { id: 'n', restaurant_id: 'n', date: 'd', amount: 'n', method: 's', note: 's', created_at: 's' },
    expenses: { id: 'n', date: 'd', category: 's', amount: 'n', supplier: 's', paid: 'b', note: 's', created_at: 's' },
    ingredients: { id: 'n', name: 's', unit: 's', cost: 'n', active: 'b', buy_price: 'n?', buy_qty: 'n?', buy_unit: 's?', pack: 'n?' },
    recipe_items: { product_id: 'n', ingredient_id: 'n', qty: 'n', unit: ['غرام', 'كغ', 'مل', 'لتر', 'حبة'] },
    stock_moves: { id: 'n', ingredient_id: 'n', kind: ['count', 'add', 'use'], qty: 'n', date: 'd', at: 's' },
  };
  const ITEM = { product_id: 'n', qty: 'n', price: 'n' };
  function cleanRec(x, sch) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const o = {};
    for (const [k, t] of Object.entries(sch)) {
      const v = x[k];
      if (Array.isArray(t)) { o[k] = t.includes(v) ? v : t[0]; continue; }
      if (t.endsWith('?') && (v === undefined || v === null || v === '')) continue;
      if (t[0] === 'n') { const n = Number(v); o[k] = Number.isFinite(n) ? n : 0; }
      else if (t === 'b') o[k] = v ? 1 : 0;
      else if (t === 'd') { if (!isDate(v)) return null; o[k] = v; }
      else if (t === 'u') o[k] = SAFE_URL(v);
      else o[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
    }
    return o;
  }
  function normalize(d) {
    const out = empty(); out.v = Number(d.v) || 1;
    for (const k of Object.keys(SCHEMA)) {
      const arr = Array.isArray(d[k]) ? d[k] : [];
      out[k] = arr.map(x => { const r = cleanRec(x, SCHEMA[k]); if (r && k === 'orders') r.items = (Array.isArray(x.items) ? x.items : []).map(i => cleanRec(i, ITEM)).filter(Boolean); return r; }).filter(Boolean);
    }
    const s = d.settings && typeof d.settings === 'object' ? d.settings : {};
    out.settings.factory_name = typeof s.factory_name === 'string' ? s.factory_name : out.settings.factory_name;
    for (const k of ['backup_every', 'stop_days']) if (Number.isFinite(Number(s[k])) && s[k] !== null && s[k] !== '') out.settings[k] = Number(s[k]);
    if (typeof s.last_backup === 'string' && !isNaN(Date.parse(s.last_backup))) out.settings.last_backup = s.last_backup;
    if (/^[0-9a-f]{16,128}$/.test(s.pin_hash || '') && /^[0-9a-f]{16,128}$/.test(s.pin_salt || '')) { out.settings.pin_hash = s.pin_hash; out.settings.pin_salt = s.pin_salt; }
    const seq = d.seq && typeof d.seq === 'object' ? d.seq : {};
    for (const k of Object.keys(SCHEMA)) out.seq[k] = Math.max(Number.isFinite(Number(seq[k])) ? Number(seq[k]) : 0, ...out[k].map(x => x.id || 0));
    if (d.saved_at && typeof d.saved_at === 'string') out.saved_at = d.saved_at;
    return out;
  }
  class ApiError extends Error { constructor(m, s = 400) { super(m); this.status = s; } }
  const fail = (m, s) => { throw new ApiError(m, s); };
  function addProduct(name, unit, price) { DB.products.push({ id: nextId('products'), name, unit: unit || 'حبة', price: Number(price) || 0, active: 1, sort: DB.products.length + 1 }); }
  const sortProducts = a => a.slice().sort((x, y) => (y.active - x.active) || (x.sort - y.sort) || (x.id - y.id));
  const live = o => o.status !== 'cancelled';
  const orderTotal = o => round2(o.items.reduce((s, i) => s + i.qty * i.price, 0));
  function orderWithItems(o) {
    if (!o) return null;
    const items = o.items.map(i => { const p = byId('products', i.product_id) || { name: '؟', unit: '', sort: 0 }; return { product_id: i.product_id, name: p.name, unit: p.unit, qty: i.qty, price: i.price, _s: p.sort }; }).sort((a, b) => a._s - b._s).map(({ _s, ...x }) => x);
    return { ...o, items, total: orderTotal(o) };
  }
  const deliveredSales = rid => round2(DB.orders.filter(o => o.restaurant_id === rid && o.status === 'delivered').reduce((s, o) => s + orderTotal(o), 0));
  const paidBy = rid => round2(DB.payments.filter(p => p.restaurant_id === rid).reduce((s, p) => s + p.amount, 0));

  // ---------- PIN (PBKDF2 مشفّر على الجهاز) ----------
  const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  async function pbkdf2(pin, saltHex) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256));
  }
  async function setPin(pin) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); DB.settings.pin_salt = salt; DB.settings.pin_hash = await pbkdf2(pin, salt); }
  async function checkPin(pin) { if (!DB.settings.pin_hash) return false; return (await pbkdf2(String(pin || ''), DB.settings.pin_salt)) === DB.settings.pin_hash; }
  // حد للمحاولات محفوظ على الجهاز (ما بينمسح بإعادة فتح التطبيق): بعد 5 أخطاء قفل دقيقة، وكل قفل بعده ضعف اللي قبله (لحد ساعة)
  const LOCK_KEY = 'talabiyat_lock';
  const lockGet = () => { try { const x = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); return { f: Number(x.f) || 0, until: Number(x.until) || 0, n: Number(x.n) || 0 }; } catch (_) { return { f: 0, until: 0, n: 0 }; } };
  const lockSet = x => localStorage.setItem(LOCK_KEY, JSON.stringify(x));
  async function guardedPin(pin) {
    const L = lockGet(), left = L.until - Date.now();
    if (left > 0) fail(`محاولات كثيرة، جرّب بعد ${Math.ceil(left / 60e3)} دقيقة`, 429);
    if (await checkPin(pin)) { lockSet({ f: 0, until: 0, n: 0 }); return true; }
    L.f++; if (L.f >= 5) { L.until = Date.now() + Math.min(60e3 * 2 ** L.n, 3600e3); L.n++; L.f = 0; } lockSet(L);
    return false;
  }
  const SESSION_DAYS = 30;
  const loggedIn = () => DB.settings.pin_hash && Number(localStorage.getItem('talabiyat_auth') || 0) > Date.now();

  // ---------- وصفات وتكلفة ----------
  const LINE_UNITS = { 'غرام': ['كغ', 0.001], 'كغ': ['كغ', 1], 'مل': ['لتر', 0.001], 'لتر': ['لتر', 1], 'حبة': ['حبة', 1] };
  function toIngUnit(qty, lu, iu) { const u = LINE_UNITS[lu]; if (!u) return qty; if (u[0] === iu) return qty * u[1]; if (iu === 'غرام' && u[0] === 'كغ') return qty * u[1] * 1000; if (iu === 'مل' && u[0] === 'لتر') return qty * u[1] * 1000; return qty; }
  function recipes() {
    return sortProducts(DB.products).map(p => {
      const lines = DB.recipe_items.filter(r => r.product_id === p.id).map(r => { const i = byId('ingredients', r.ingredient_id); if (!i) return null;
        return { ingredient_id: i.id, qty: r.qty, unit: r.unit, name: i.name, ing_unit: i.unit, cost: i.cost, line_cost: Math.round(toIngUnit(r.qty, r.unit, i.unit) * i.cost * 10000) / 10000 }; }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const cost = Math.round(lines.reduce((s, l) => s + l.line_cost, 0) * 1000) / 1000;
      return { id: p.id, name: p.name, unit: p.unit, price: p.price, active: p.active, lines, cost_per_unit: cost, margin_per_unit: round2(p.price - cost) };
    });
  }
  function dayTotals(date) {
    const t = {};
    DB.orders.filter(o => o.delivery_date === date && live(o)).forEach(o => o.items.forEach(i => { const x = t[i.product_id] = t[i.product_id] || { product_id: i.product_id, qty: 0, value: 0 }; x.qty += i.qty; x.value += i.qty * i.price; }));
    return Object.values(t);
  }
  function stopped(days) {
    const since = addDays(today(), -days);
    return DB.restaurants.filter(r => r.active).map(r => { const last = DB.orders.filter(o => o.restaurant_id === r.id && live(o)).map(o => o.delivery_date).sort().pop() || null;
      return { id: r.id, name: r.name, phone: r.phone, last_order: last, days_since: last ? daysBetween(last, today()) : null }; })
      .filter(r => !r.last_order || r.last_order < since).sort((a, b) => (b.days_since ?? 1e9) - (a.days_since ?? 1e9));
  }
  // يستخرج إحداثيات من رابط خرائط (Google/Apple/OSM)
  function coordsFrom(url) { const m = String(url || '').match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/) || String(url || '').match(/mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/); return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null; }

  // ---------- الموجّه: نفس عناوين الخادم القديم ----------
  const routes = [];
  const on = (method, pattern, fn, open) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, open });

  on('GET', '/api/me', () => ({ role: loggedIn() ? 'manager' : null, has_pin: !!DB.settings.pin_hash, factory_name: DB.settings.factory_name }), true);
  on('POST', '/api/logout', () => { localStorage.removeItem('talabiyat_auth'); return { ok: true }; }, true);
  on('POST', '/api/setup', async b => {
    if (DB.settings.pin_hash) fail('الرقم السري محدد مسبقاً');
    if (!/^\d{4,8}$/.test(String(b.pin || ''))) fail('الرقم السري لازم يكون من 4 إلى 8 أرقام');
    if (String(b.pin) !== String(b.confirm)) fail('الرقمين مش متطابقين');
    await setPin(b.pin); if (b.factory_name) DB.settings.factory_name = String(b.factory_name).trim();
    localStorage.setItem('talabiyat_auth', Date.now() + SESSION_DAYS * 864e5); return { ok: true };
  }, true);
  on('POST', '/api/manager/login', async b => {
    if (!(await guardedPin(b.pin))) fail('الرقم السري غير صحيح', 401);
    localStorage.setItem('talabiyat_auth', Date.now() + SESSION_DAYS * 864e5); return { ok: true };
  }, true);

  on('GET', '/api/m/lookups', () => ({ today: today(), products: sortProducts(DB.products).filter(p => p.active).map(({ id, name, unit, price }) => ({ id, name, unit, price })),
    restaurants: DB.restaurants.slice().sort((a, b) => (b.active - a.active) || (a.route_order - b.route_order) || (a.id - b.id)).map(({ id, name, active }) => ({ id, name, active })) }));
  on('GET', '/api/m/day', (b, q) => {
    const date = isDate(q.date) ? q.date : today();
    const orders = DB.orders.filter(o => o.delivery_date === date).map(o => { const r = byId('restaurants', o.restaurant_id) || {}; return { ...orderWithItems(o), restaurant_name: r.name, phone: r.phone, address: r.address, map_url: r.map_url, lat: r.lat, lng: r.lng, _ro: r.route_order || 0 }; })
      .sort((a, b) => a._ro - b._ro || a.restaurant_id - b.restaurant_id);
    const totals = dayTotals(date).map(t => { const p = byId('products', t.product_id) || {}; return { id: t.product_id, name: p.name, unit: p.unit, qty: t.qty, _s: p.sort }; }).sort((a, b) => a._s - b._s);
    return { date, today: today(), totals, orders, day_total: round2(orders.filter(live).reduce((s, o) => s + o.total, 0)) };
  });
  on('POST', '/api/m/orders/:id/status', (b, q, p) => { if (!['new', 'prepared', 'delivered', 'cancelled'].includes(b.status)) fail('حالة غير صحيحة'); const o = byId('orders', p.id); if (!o) fail('غير موجود'); o.status = b.status; o.updated_at = nowIso(); return { ok: true }; });
  on('GET', '/api/m/order', (b, q) => orderWithItems(DB.orders.find(o => o.restaurant_id === Number(q.restaurant_id) && o.delivery_date === q.date)) || null);
  on('POST', '/api/m/order', b => {
    if (!isDate(b.delivery_date)) fail('تاريخ غير صحيح');
    const rid = Number(b.restaurant_id); if (!byId('restaurants', rid)) fail('اختر المطعم');
    const clean = (b.items || []).map(i => ({ product_id: Number(i.product_id), qty: Number(i.qty) })).filter(i => i.qty > 0 && byId('products', i.product_id));
    let o = DB.orders.find(x => x.restaurant_id === rid && x.delivery_date === b.delivery_date);
    if (o && o.status === 'delivered') fail('الطلبية تم توصيلها ولا يمكن تعديلها');
    if (!clean.length) { if (o) DB.orders = DB.orders.filter(x => x !== o); return { ok: true }; }
    if (!o) { o = { id: nextId('orders'), restaurant_id: rid, delivery_date: b.delivery_date, status: 'new', source: 'manager', created_at: nowIso() }; DB.orders.push(o); }
    o.note = b.note || ''; o.status = 'new'; o.updated_at = nowIso();
    o.items = clean.map(i => ({ ...i, price: byId('products', i.product_id).price }));
    return { ok: true };
  });
  on('GET', '/api/m/history', () => {
    const d = {};
    DB.orders.forEach(o => { const x = d[o.delivery_date] = d[o.delivery_date] || { date: o.delivery_date, orders: 0, delivered: 0, total: 0 }; x.orders++; if (o.status === 'delivered') x.delivered++; if (live(o)) x.total = round2(x.total + orderTotal(o)); });
    return Object.values(d).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 120);
  });
  on('GET', '/api/m/products', () => sortProducts(DB.products));
  on('POST', '/api/m/products', b => {
    if (!b.name || !String(b.name).trim()) fail('اكتب اسم الصنف');
    if (b.id) { const p = byId('products', b.id); Object.assign(p, { name: b.name.trim(), unit: b.unit || 'حبة', price: toNum(b.price) || 0, active: b.active ? 1 : 0 }); }
    else addProduct(b.name.trim(), b.unit, toNum(b.price));
    return { ok: true };
  });
  on('GET', '/api/m/restaurants', () => {
    const lim = addDays(today(), 7);
    return DB.restaurants.map(r => { const last = DB.orders.filter(o => o.restaurant_id === r.id && live(o) && o.delivery_date <= lim).map(o => o.delivery_date).sort().pop() || null;
      return { ...r, last_order: last, days_since: last ? Math.max(0, daysBetween(last, today())) : null, balance: round2(deliveredSales(r.id) - paidBy(r.id)) }; })
      .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'ar'));
  });
  on('POST', '/api/m/restaurants', b => {
    if (!b.name || !String(b.name).trim()) fail('اكتب اسم المطعم');
    const f = { name: String(b.name).trim(), phone: String(b.phone || ''), address: String(b.address || ''), map_url: SAFE_URL(b.map_url) };
    if (String(b.map_url || '').trim() && !f.map_url) fail('رابط الخريطة لازم يبدأ بـ https://');
    const c = coordsFrom(f.map_url);
    if (b.lat != null && b.lat !== '' && !isNaN(b.lat)) { f.lat = Number(b.lat); f.lng = Number(b.lng); } else if (c) Object.assign(f, c);
    if (b.id) Object.assign(byId('restaurants', b.id), f);
    else DB.restaurants.push({ id: nextId('restaurants'), ...f, active: 1, route_order: DB.restaurants.reduce((m, r) => Math.max(m, r.route_order || 0), 0) + 1, created_at: nowIso() });
    return { ok: true };
  });
  on('POST', '/api/m/restaurants/:id/active', (b, q, p) => { byId('restaurants', p.id).active = b.active ? 1 : 0; return { ok: true }; });
  on('POST', '/api/m/route', b => { (b.ids || []).map(Number).forEach((id, i) => { const r = byId('restaurants', id); if (r) r.route_order = i + 1; }); return { ok: true }; });
  on('GET', '/api/m/stopped', (b, q) => { const days = Math.max(1, Number(q.days) || 7); return { days, rows: stopped(days) }; });
  on('GET', '/api/m/settings', () => { const s = DB.settings; return { factory_name: s.factory_name, backup_every: s.backup_every, stop_days: s.stop_days, last_backup: s.last_backup || null, saved_at: DB.saved_at }; });
  on('POST', '/api/m/settings', b => {
    if (b.factory_name) DB.settings.factory_name = String(b.factory_name).trim();
    if (b.backup_every != null) DB.settings.backup_every = Number(b.backup_every) || 0;
    if (b.stop_days != null) DB.settings.stop_days = Math.max(1, Number(b.stop_days) || 7);
    return { ok: true };
  });
  on('POST', '/api/m/pin', async b => {
    if (!(await guardedPin(b.current))) fail('الرقم السري الحالي غير صحيح');
    if (!/^\d{4,8}$/.test(String(b.new_pin || ''))) fail('الرقم الجديد لازم يكون من 4 إلى 8 أرقام');
    if (String(b.new_pin) !== String(b.confirm)) fail('الرقم الجديد والتأكيد مش متطابقين');
    await setPin(b.new_pin); return { ok: true };
  });
  // ----- الحسابات -----
  on('GET', '/api/m/finance/balances', () => {
    const rows = DB.restaurants.map(r => { const sales = deliveredSales(r.id), paid = paidBy(r.id); return { id: r.id, name: r.name, phone: r.phone, sales, paid, balance: round2(sales - paid) }; }).sort((a, b) => b.balance - a.balance);
    const sup = {}; DB.expenses.filter(e => !e.paid).forEach(e => sup[e.supplier || ''] = round2((sup[e.supplier || ''] || 0) + e.amount));
    const supplier = Object.entries(sup).map(([supplier, amount]) => ({ supplier, amount })).sort((a, b) => b.amount - a.amount);
    return { rows, total_outstanding: round2(rows.reduce((s, r) => s + Math.max(0, r.balance), 0)), supplier_debts: supplier, supplier_total: round2(supplier.reduce((s, x) => s + x.amount, 0)) };
  });
  on('GET', '/api/m/finance/statement', (b, q) => {
    const to = isDate(q.to) ? q.to : today(), from = isDate(q.from) ? q.from : addDays(to, -30), rid = Number(q.restaurant_id);
    const r = byId('restaurants', rid); if (!r) fail('مطعم غير موجود');
    const del = DB.orders.filter(o => o.restaurant_id === rid && o.status === 'delivered'), pays = DB.payments.filter(p => p.restaurant_id === rid);
    const opening = round2(del.filter(o => o.delivery_date < from).reduce((s, o) => s + orderTotal(o), 0) - pays.filter(p => p.date < from).reduce((s, p) => s + p.amount, 0));
    const lines = [];
    del.filter(o => o.delivery_date >= from && o.delivery_date <= to).map(orderWithItems).forEach(o => lines.push({ date: o.delivery_date, kind: 'order', desc: o.items.map(i => `${i.name} ${i.qty} ${i.unit}`).join('، '), debit: o.total, credit: 0 }));
    pays.filter(p => p.date >= from && p.date <= to).forEach(p => lines.push({ id: p.id, date: p.date, kind: 'payment', desc: `دفعة ${p.method}${p.note ? ' - ' + p.note : ''}`, debit: 0, credit: round2(p.amount) }));
    lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'order' ? -1 : 1));
    let bal = opening; lines.forEach(l => { bal = round2(bal + l.debit - l.credit); l.balance = bal; });
    return { restaurant: { id: r.id, name: r.name, phone: r.phone, address: r.address }, from, to, opening, closing: bal, lines, factory_name: DB.settings.factory_name };
  });
  on('POST', '/api/m/finance/payments', b => {
    const amount = Number(b.amount); if (!(amount > 0)) fail('اكتب المبلغ'); if (!byId('restaurants', b.restaurant_id)) fail('اختر المطعم');
    DB.payments.push({ id: nextId('payments'), restaurant_id: Number(b.restaurant_id), date: isDate(b.date) ? b.date : today(), amount, method: b.method || 'نقدي', note: b.note || '', created_at: nowIso() }); return { ok: true };
  });
  on('DELETE', '/api/m/finance/payments/:id', (b, q, p) => { DB.payments = DB.payments.filter(x => x.id !== Number(p.id)); return { ok: true }; });
  const monthOf = q => /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : today().slice(0, 7);
  on('GET', '/api/m/finance/expenses', (b, q) => { const m = monthOf(q); return DB.expenses.filter(e => e.date.slice(0, 7) === m).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id); });
  on('POST', '/api/m/finance/expenses', b => {
    if (!(Number(b.amount) > 0)) fail('اكتب المبلغ');
    const f = { date: isDate(b.date) ? b.date : today(), category: b.category || 'أخرى', amount: Number(b.amount), supplier: b.supplier || '', paid: b.paid ? 1 : 0, note: b.note || '' };
    if (b.id) Object.assign(byId('expenses', b.id), f); else DB.expenses.push({ id: nextId('expenses'), ...f, created_at: nowIso() });
    return { ok: true };
  });
  on('DELETE', '/api/m/finance/expenses/:id', (b, q, p) => { DB.expenses = DB.expenses.filter(x => x.id !== Number(p.id)); return { ok: true }; });
  on('GET', '/api/m/finance/summary', (b, q) => {
    const month = monthOf(q), days = {}, d = k => (days[k] = days[k] || { date: k, sales: 0, collected: 0, expenses: 0 });
    DB.orders.filter(o => o.status === 'delivered' && o.delivery_date.slice(0, 7) === month).forEach(o => d(o.delivery_date).sales = round2(d(o.delivery_date).sales + orderTotal(o)));
    DB.payments.filter(p => p.date.slice(0, 7) === month).forEach(p => d(p.date).collected = round2(d(p.date).collected + p.amount));
    const cat = {};
    DB.expenses.filter(e => e.date.slice(0, 7) === month).forEach(e => { d(e.date).expenses = round2(d(e.date).expenses + e.amount); cat[e.category] = round2((cat[e.category] || 0) + e.amount); });
    const list = Object.values(days).sort((a, b) => b.date.localeCompare(a.date)), sum = f => round2(list.reduce((s, x) => s + x[f], 0));
    return { month, days: list, sales: sum('sales'), collected: sum('collected'), expenses: sum('expenses'), profit: round2(sum('sales') - sum('expenses')),
      by_category: Object.entries(cat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount), today: today() };
  });
  // ----- مواد خام ووصفات وتوقعات -----
  // سعر الشراء حر: «X ريال لكل N وحدة» (كرتون/علبة… مع كم فيه من وحدة الحساب). البيانات القديمة: cost لكل وحدة ⇒ لكل 1
  const toNum = v => Number(String(v ?? '').trim().replace(/[٠-٩]/g, d => d.charCodeAt(0) - 1632).replace(/[٫,]/g, '.'));
  const unitFactor = (bu, base) => { const a = LINE_UNITS[bu], b = LINE_UNITS[base]; return a && b && a[0] === b[0] ? a[1] / b[1] : (bu === base ? 1 : null); };
  const ingOut = i => ({ ...i, buy_price: i.buy_price ?? i.cost, buy_qty: i.buy_qty || 1, buy_unit: i.buy_unit || i.unit, pack: i.pack || null });
  on('GET', '/api/m/ingredients', () => DB.ingredients.map(ingOut).sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'ar')));
  on('POST', '/api/m/ingredients', b => {
    if (!b.name || !String(b.name).trim()) fail('اكتب اسم المادة');
    const unit = b.unit || 'كغ', f = { name: b.name.trim(), unit, active: b.active === false ? 0 : 1 };
    if (b.buy_price === undefined) f.cost = toNum(b.cost) || 0; // صيغة قديمة: سعر لكل وحدة
    else {
      const price = toNum(b.buy_price), qty = b.buy_qty === undefined || String(b.buy_qty).trim() === '' ? 1 : toNum(b.buy_qty), bu = String(b.buy_unit || unit).trim() || unit;
      if (!(price >= 0)) fail('اكتب سعر الشراء رقم'); if (!(qty > 0)) fail('اكتب الكمية (لكل كم؟) رقم أكبر من صفر');
      let fac = unitFactor(bu, unit), pack = null;
      if (fac == null) { pack = toNum(b.pack); if (!(pack > 0)) fail(`اكتب كم ${unit} في ال${bu} الواحد`); fac = pack; }
      Object.assign(f, { buy_price: price, buy_qty: qty, buy_unit: bu, pack, cost: Math.round(price / (qty * fac) * 1e6) / 1e6 });
    }
    if (b.id) Object.assign(byId('ingredients', b.id), f); else DB.ingredients.push({ id: nextId('ingredients'), ...f });
    return { ok: true };
  });
  on('GET', '/api/m/recipes', () => recipes());
  on('POST', '/api/m/recipes/:pid', (b, q, p) => {
    const pid = Number(p.pid), seen = new Set();
    DB.recipe_items = DB.recipe_items.filter(r => r.product_id !== pid);
    (b.lines || []).filter(l => Number(l.ingredient_id) && Number(l.qty) > 0 && !seen.has(Number(l.ingredient_id)) && seen.add(Number(l.ingredient_id)))
      .forEach(l => DB.recipe_items.push({ product_id: pid, ingredient_id: Number(l.ingredient_id), qty: Number(l.qty), unit: LINE_UNITS[l.unit] ? l.unit : 'غرام' }));
    return { ok: true };
  });
  on('GET', '/api/m/forecast', (b, q) => {
    const date = isDate(q.date) ? q.date : addDays(today(), 1);
    const R = recipes(), rb = Object.fromEntries(R.map(r => [r.id, r])), totals = dayTotals(date);
    const needs = {}; let cost = 0, value = 0;
    totals.forEach(t => { const r = rb[t.product_id]; if (!r) return; value += t.value; cost += t.qty * r.cost_per_unit;
      r.lines.forEach(l => { const n = needs[l.ingredient_id] = needs[l.ingredient_id] || { name: l.name, unit: l.ing_unit, amount: 0, cost: 0 }; n.amount += toIngUnit(l.qty, l.unit, l.ing_unit) * t.qty; n.cost += l.line_cost * t.qty; }); });
    const past = [1, 2, 3, 4].map(w => addDays(date, -7 * w));
    const suggestions = R.filter(r => r.active).map(r => { const qs = past.map(d => dayTotals(d).filter(t => t.product_id === r.id).reduce((s, t) => s + t.qty, 0)).filter(x => x > 0);
      return { product_id: r.id, name: r.name, unit: r.unit, avg: qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : 0, weeks: qs.length, ordered: (totals.find(t => t.product_id === r.id) || {}).qty || 0 }; });
    return { date, needs: Object.values(needs).map(n => ({ ...n, amount: Math.round(n.amount * 1000) / 1000, cost: round2(n.cost) })).sort((a, b) => b.cost - a.cost),
      production_cost: round2(cost), sales_value: round2(value), profit: round2(value - cost), suggestions,
      products: totals.map(t => ({ ...t, name: (rb[t.product_id] || {}).name, unit: (rb[t.product_id] || {}).unit, cost_per_unit: (rb[t.product_id] || {}).cost_per_unit })) };
  });
  // ----- المخزون: معدل الاستهلاك والأيام المتبقية (تقدير) -----
  // الاستهلاك = الطلبيات (غير الملغاة) × الوصفات + أي صرف/هدر يدوي. النافذة: آخر 7–14 يوم حسب البيانات المتوفرة.
  const STOCK_MIN_DAYS = 7, STOCK_MAX_DAYS = 14, STOCK_RED = 3, STOCK_YELLOW = 5;
  function ingPerProduct(ing) { const per = {}; DB.recipe_items.filter(r => r.ingredient_id === ing.id).forEach(r => per[r.product_id] = toIngUnit(r.qty, r.unit, ing.unit)); return per; }
  function usage(ing, after, upto, per, afterAt) { // استهلاك في الفترة (after, upto]؛ ولو afterAt: طلبيات نفس يوم الجرد المسجّلة بعده
    let u = 0;
    DB.orders.forEach(o => { if (!live(o) || o.delivery_date > upto) return;
      if (o.delivery_date < after || (o.delivery_date === after && !(afterAt && (o.created_at || '') > afterAt))) return;
      o.items.forEach(i => { if (per[i.product_id]) u += per[i.product_id] * i.qty; }); });
    return u;
  }
  function stockInfo() {
    const t = today(), mv = DB.stock_moves || [];
    const dates = DB.orders.filter(live).map(o => o.delivery_date).concat(mv.map(m => m.date)).filter(d => d <= t).sort();
    const start = dates.length ? (dates[0] > addDays(t, -(STOCK_MAX_DAYS - 1)) ? dates[0] : addDays(t, -(STOCK_MAX_DAYS - 1))) : t;
    const window_days = dates.length ? daysBetween(start, t) + 1 : 0;
    const items = DB.ingredients.filter(i => i.active).map(ing => {
      const per = ingPerProduct(ing), my = mv.filter(m => m.ingredient_id === ing.id).sort((a, b) => a.id - b.id);
      const r = { id: ing.id, name: ing.name, unit: ing.unit, has_recipe: Object.keys(per).length > 0, stock: null, rate: null, days_left: null, runout: null, level: 'none', reason: '' };
      if (my.length) {
        const cnt = my.filter(m => m.kind === 'count').pop(), base = cnt || my[0];
        let s = cnt ? cnt.qty : 0;
        my.forEach(m => { if (cnt && m.id <= cnt.id) return; if (m.kind === 'add') s += m.qty; if (m.kind === 'use') s -= m.qty; });
        s -= usage(ing, base.date, t, per, base.at);
        r.stock = Math.round(s * 1000) / 1000; r.updated = base.date;
      }
      const wUse = usage(ing, addDays(start, -1), t, per) + mv.filter(m => m.ingredient_id === ing.id && m.kind === 'use' && m.date >= start && m.date <= t).reduce((a, m) => a + m.qty, 0);
      if (window_days < STOCK_MIN_DAYS) r.reason = 'few_days';
      else if (!r.has_recipe && !wUse) r.reason = 'no_recipe';
      else if (wUse <= 0) r.reason = 'no_use';
      else r.rate = wUse / window_days;
      if (r.stock != null && r.stock <= 0) { r.days_left = 0; r.runout = t; r.level = 'red'; }
      else if (r.stock != null && r.rate) {
        r.days_left = Math.round(r.stock / r.rate * 10) / 10; r.runout = addDays(t, Math.floor(r.stock / r.rate));
        r.level = r.days_left < STOCK_RED ? 'red' : r.days_left < STOCK_YELLOW ? 'yellow' : 'ok';
      }
      if (r.rate) r.rate = Math.round(r.rate * 1000) / 1000;
      return r;
    });
    const rank = { red: 0, yellow: 1, ok: 2, none: 3 };
    items.sort((a, b) => rank[a.level] - rank[b.level] || (a.days_left ?? 1e9) - (b.days_left ?? 1e9) || a.name.localeCompare(b.name, 'ar'));
    return { today: t, window_days: Math.min(window_days, STOCK_MAX_DAYS), min_days: STOCK_MIN_DAYS, red_days: STOCK_RED, yellow_days: STOCK_YELLOW, items,
      alerts: items.filter(i => i.level === 'red' || i.level === 'yellow'), tracked: items.filter(i => i.stock != null).length };
  }
  on('GET', '/api/m/stock', () => stockInfo());
  on('POST', '/api/m/stock/:id', (b, q, p) => {
    const ing = byId('ingredients', p.id); if (!ing) fail('مادة غير موجودة');
    if (!['count', 'add', 'use'].includes(b.kind)) fail('نوع غير صحيح');
    const qty = Number(String(b.qty ?? '').replace(',', '.'));
    if (!(qty >= 0) || String(b.qty ?? '').trim() === '' || (b.kind !== 'count' && !(qty > 0))) fail('اكتب الكمية');
    DB.stock_moves.push({ id: nextId('stock_moves'), ingredient_id: ing.id, kind: b.kind, qty, date: isDate(b.date) ? b.date : today(), at: nowIso() });
    return { ok: true };
  });
  // ----- تنبيهات محسوبة داخل التطبيق -----
  on('GET', '/api/m/reminders', () => {
    const s = DB.settings, t = today(), out = [];
    const hasData = DB.orders.length || DB.restaurants.length || DB.payments.length;
    if (s.backup_every > 0 && hasData && (!s.last_backup || daysBetween(s.last_backup.slice(0, 10), t) >= s.backup_every))
      out.push({ kind: 'backup', text: s.last_backup ? `آخر نسخة احتياطية قبل ${daysBetween(s.last_backup.slice(0, 10), t)} يوم` : 'لسا ما عملت نسخة احتياطية' });
    const tom = addDays(t, 1), wd = new Date(tom + 'T12:00:00Z').getUTCDay();
    const usual = DB.restaurants.filter(r => r.active && !DB.orders.some(o => o.restaurant_id === r.id && o.delivery_date === tom) &&
      [1, 2, 3].filter(w => DB.orders.some(o => o.restaurant_id === r.id && live(o) && o.delivery_date === addDays(tom, -7 * w))).length >= 2);
    if (usual.length) out.push({ kind: 'usual', text: `عادةً بيطلبوا ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][wd]} ولسا ما في طلب لبكرة: ${usual.map(r => r.name).join('، ')}` });
    const st = stopped(s.stop_days || 7).filter(r => r.last_order);
    if (st.length) out.push({ kind: 'stopped', text: `${st.length} زبون ما طلبوا من ${s.stop_days || 7} أيام أو أكثر` });
    const notDelivered = DB.orders.filter(o => o.delivery_date < t && (o.status === 'new' || o.status === 'prepared')).length;
    if (notDelivered) out.push({ kind: 'old', text: `${notDelivered} طلبية من أيام سابقة لسا مش معلّمة «تم التوصيل»` });
    const sup = DB.expenses.filter(e => !e.paid).reduce((a, e) => a + e.amount, 0);
    if (sup > 0) out.push({ kind: 'supplier', text: `عليك للموردين ${round2(sup).toLocaleString('en-US')} ريال` });
    return out;
  });
  // ----- نسخ احتياطي واستعادة -----
  on('POST', '/api/m/backup-done', () => { DB.settings.last_backup = nowIso(); return { ok: true }; });
  on('POST', '/api/m/restore', b => {
    const d = b.data; if (!d || d.app !== 'talabiyat' || !Array.isArray(d.orders) || !Array.isArray(d.products)) fail('الملف مش نسخة احتياطية من طلبيات');
    const keep = { pin_hash: DB.settings.pin_hash, pin_salt: DB.settings.pin_salt };
    DB = normalize(d);
    if (!b.use_backup_pin || !DB.settings.pin_hash) Object.assign(DB.settings, keep); // افتراضياً: نحتفظ بالرقم السري الحالي
    DB.settings.last_backup = DB.settings.last_backup || nowIso();
    return { ok: true, counts: { orders: DB.orders.length, restaurants: DB.restaurants.length, payments: DB.payments.length } };
  });

  async function api(url, body, method) {
    await load();
    const u = new URL(url, location.href), m = method || (body ? 'POST' : 'GET');
    const path = u.pathname.replace(/^.*?(\/api\/)/, '/api/');
    const q = Object.fromEntries(u.searchParams);
    for (const r of routes) {
      const mt = r.method === m && path.match(r.re); if (!mt) continue;
      if (!r.open && !loggedIn()) throw new ApiError('سجّل الدخول أولاً', 401);
      const res = await r.fn(body || {}, q, mt.groups || {});
      if (m !== 'GET') await save();
      return res;
    }
    throw new ApiError('غير موجود', 404);
  }
  // تصدير متزامن (بدون انتظار) حتى تبقى نافذة المشاركة في iPhone مرتبطة بضغطة الزر
  function exportJson() { if (!DB || !loggedIn()) throw new ApiError('سجّل الدخول أولاً', 401); return JSON.stringify({ ...DB, exported_at: nowIso() }); }
  window.Store = { api, load, save, today, coordsFrom, exportJson, ApiError };
})();
