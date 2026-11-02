// مصنع الأكل — خادم بسيط (Express + SQLite المدمج في Node)
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3030;
const TZ = 'Asia/Riyadh';
const fs = require('fs');
// مكان قاعدة البيانات: DB_PATH أو DATA_DIR (مثلاً /var/data على Render) وإلا مجلد التطبيق
function dataDir() {
  const d = process.env.DATA_DIR;
  if (d) { try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch (e) { console.warn(`DATA_DIR ${d} غير متاح (${e.code}) — سأستخدم مجلد التطبيق، والبيانات غير دائمة`); } }
  return __dirname;
}
const DB_FILE = process.env.DB_PATH || path.join(dataDir(), 'data.db');
console.log('database:', DB_FILE);
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'حبة', price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS restaurants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, pin TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, sample INTEGER NOT NULL DEFAULT 0, route_order INTEGER NOT NULL DEFAULT 0, map_url TEXT);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), delivery_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', note TEXT, source TEXT DEFAULT 'restaurant', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (restaurant_id, delivery_date));
CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), qty REAL NOT NULL, price REAL NOT NULL DEFAULT 0, PRIMARY KEY (order_id, product_id));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id), date TEXT NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL DEFAULT 'نقدي', note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, supplier TEXT, paid INTEGER NOT NULL DEFAULT 1, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ingredients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'كغ', cost REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS recipe_items (product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE, qty REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'غرام', PRIMARY KEY (product_id, ingredient_id));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, role TEXT NOT NULL, restaurant_id INTEGER, created_at TEXT NOT NULL);
`);

// ---------- helpers ----------
const nowIso = () => new Date().toISOString();
function riyadhParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
function addDays(dateStr, n) { const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const getSetting = k => (db.prepare('SELECT value FROM settings WHERE key=?').get(k) || {}).value;
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
// Next delivery date a restaurant may order for: tomorrow if before cutoff, else after tomorrow
function nextDeliveryDate() {
  const { date, time } = riyadhParts();
  const cutoff = getSetting('cutoff_time') || '20:00';
  return addDays(date, time < cutoff ? 1 : 2);
}
function priceFor(_restaurantId, productId) { // سعر موحّد لكل المطاعم
  const p = db.prepare('SELECT price FROM products WHERE id=?').get(productId);
  return p ? p.price : 0;
}
function tx(fn) { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }
// الرقم السري للمدير يُحفظ مشفّراً (scrypt + salt)
function hashPin(pin) { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(String(pin), salt, 32).toString('hex')}`; }
function checkManagerPin(pin) {
  const stored = getSetting('manager_pin') || ''; pin = String(pin || '');
  if (stored.startsWith('scrypt$')) { const [, salt, h] = stored.split('$'); const a = crypto.scryptSync(pin, salt, 32), b = Buffer.from(h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
  const ok = !!stored && pin === stored; if (ok) setSetting('manager_pin', hashPin(pin)); // ترقية رقم قديم غير مشفّر
  return ok;
}
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// ---------- seed ----------
const PROD = process.env.NODE_ENV === 'production';
const SEED_DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : !PROD; // بيانات تجريبية: افتراضياً في التطوير فقط
if (!getSetting('initialized')) {
  tx(() => {
    // الرقم السري: من MANAGER_PIN، وفي الإنتاج بدونه رقم عشوائي (يُطبع مرة واحدة في السجل)، وفي التطوير 2580
    let pin = (process.env.MANAGER_PIN || '').trim();
    if (!/^\d{4,8}$/.test(pin)) { pin = PROD ? String(crypto.randomInt(100000, 1000000)) : '2580'; if (PROD) console.warn('MANAGER_PIN غير محدد — رقم مؤقت للمدير: ' + pin); }
    setSetting('manager_pin', hashPin(pin));
    setSetting('cutoff_time', '20:00');
    setSetting('restaurant_ordering', '0'); // صفحة المطاعم اختيارية (الأب يدخل الطلبات بنفسه)
    setSetting('factory_name', 'معمل الأكل البيتي');
    const addP = db.prepare('INSERT INTO products(name,unit,price,sort) VALUES(?,?,?,?)');
    if (!SEED_DEMO) { // بداية نظيفة: فقط الصنفين الأساسيين بدون سعر
      addP.run('ورق العنب', 'حبة', 0, 1); addP.run('الملفوف', 'حبة', 0, 2);
      setSetting('initialized', '1'); return;
    }
    const p1 = addP.run('ورق العنب', 'حبة', 1.5, 1).lastInsertRowid;
    const p2 = addP.run('الملفوف', 'حبة', 2, 2).lastInsertRowid;
    const p3 = addP.run('كوسا محشي', 'حبة', 3, 3).lastInsertRowid;
    const addR = db.prepare('INSERT INTO restaurants(name,phone,address,pin,sample,route_order) VALUES(?,?,?,?,1,(SELECT IFNULL(MAX(route_order),0)+1 FROM restaurants))');
    const rs = [
      addR.run('مطعم السرايا (تجريبي)', '0500000001', 'الرياض - حي العليا', '1111').lastInsertRowid,
      addR.run('مطعم بيت الشام (تجريبي)', '0500000002', 'الرياض - حي الملز', '2222').lastInsertRowid,
      addR.run('مطاعم الريف (تجريبي)', '0500000003', 'الرياض - حي النخيل', '3333').lastInsertRowid,
    ];
    const today = riyadhParts().date;
    const rStopped = addR.run('كافتيريا الواحة (تجريبي)', '0500000004', 'الرياض - حي الروضة', '4444').lastInsertRowid;
    const addO = db.prepare('INSERT INTO orders(restaurant_id,delivery_date,status,note,created_at,updated_at,source) VALUES(?,?,?,?,?,?,?)');
    const addI = db.prepare('INSERT INTO order_items VALUES(?,?,?,?)');
    const qtys = [[300, 150, 0], [400, 200, 100], [150, 250, 60]]; // بالحبة
    for (let d = -10; d <= 1; d++) {
      const date = addDays(today, d);
      rs.forEach((r, i) => {
        if (d < 0 && (d + i) % 4 === 0) return; // بعض الأيام بدون طلب
        const status = d < 0 ? 'delivered' : d === 0 ? (i === 0 ? 'prepared' : 'new') : 'new';
        const oid = addO.run(r, date, status, '', nowIso(), nowIso(), 'restaurant').lastInsertRowid;
        [p1, p2, p3].forEach((p, j) => { const q = qtys[i][j] ? qtys[i][j] + (d < 0 ? (Math.abs(d) % 3) * 50 : 0) : 0; if (q > 0) addI.run(oid, p, q, priceFor(r, p)); });
      });
    }
    [-20, -16, -12].forEach(d => { const oid = addO.run(rStopped, addDays(today, d), 'delivered', '', nowIso(), nowIso(), 'restaurant').lastInsertRowid; addI.run(oid, p1, 120, priceFor(rStopped, p1)); });
    const addPay = db.prepare('INSERT INTO payments(restaurant_id,date,amount,method,note,created_at) VALUES(?,?,?,?,?,?)');
    addPay.run(rs[0], addDays(today, -5), 4000, 'تحويل', 'دفعة تجريبية', nowIso());
    addPay.run(rs[1], addDays(today, -3), 6000, 'نقدي', 'دفعة تجريبية', nowIso());
    addPay.run(rs[2], addDays(today, -2), 5000, 'تحويل', 'دفعة تجريبية', nowIso());
    const addE = db.prepare('INSERT INTO expenses(date,category,amount,supplier,paid,note,created_at) VALUES(?,?,?,?,?,?,?)');
    addE.run(addDays(today, -6), 'مواد خام', 6500, 'مورد الخضار (تجريبي)', 1, 'ورق عنب وملفوف', nowIso());
    addE.run(addDays(today, -4), 'مواد خام', 3800, 'مورد الأرز (تجريبي)', 0, 'أرز ولحمة - على الحساب', nowIso());
    addE.run(addDays(today, -1), 'رواتب', 4500, '', 1, 'أجور عمال', nowIso());
    addE.run(today, 'توصيل', 150, '', 1, 'بنزين', nowIso());
    // مواد خام ووصفات تجريبية (الكمية لكل حبة)
    const addIng = db.prepare('INSERT INTO ingredients(name,unit,cost) VALUES(?,?,?)');
    const ing = {};
    [['ورق عنب', 'كغ', 30], ['أرز', 'كغ', 6], ['لحمة مفرومة', 'كغ', 45], ['ملفوف', 'كغ', 4], ['كوسا', 'كغ', 6], ['زيت', 'لتر', 10], ['بهارات', 'كغ', 40]]
      .forEach(([n, u, c]) => ing[n] = addIng.run(n + ' (تجريبي)', u, c).lastInsertRowid);
    const addRec = db.prepare('INSERT INTO recipe_items VALUES(?,?,?,?)');
    [[p1, 'ورق عنب', 4, 'غرام'], [p1, 'أرز', 8, 'غرام'], [p1, 'لحمة مفرومة', 5, 'غرام'], [p1, 'زيت', 2, 'مل'], [p1, 'بهارات', 0.3, 'غرام'],
     [p2, 'ملفوف', 25, 'غرام'], [p2, 'أرز', 12, 'غرام'], [p2, 'لحمة مفرومة', 8, 'غرام'], [p2, 'بهارات', 0.4, 'غرام'],
     [p3, 'كوسا', 120, 'غرام'], [p3, 'أرز', 20, 'غرام'], [p3, 'لحمة مفرومة', 15, 'غرام'], [p3, 'بهارات', 0.5, 'غرام']]
      .forEach(([p, n, q, u]) => addRec.run(p, ing[n], q, u));
    setSetting('initialized', '1');
  });
}

// ---------- app ----------
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function session(req) {
  const t = req.cookies.sid; if (!t) return null;
  return db.prepare('SELECT * FROM sessions WHERE token=?').get(t) || null;
}
function newSession(res, role, rid = null) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(token, role, rid, nowIso());
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 180 });
}
const requireManager = (req, res, next) => { const s = session(req); if (!s || s.role !== 'manager') return res.status(401).json({ error: 'سجّل الدخول أولاً' }); next(); };
const requireRestaurant = (req, res, next) => { if (getSetting('restaurant_ordering') !== '1') return res.status(403).json({ error: 'الطلب من المطاعم غير مفعّل حالياً، تواصل مع المعمل' }); const s = session(req); if (!s || s.role !== 'restaurant') return res.status(401).json({ error: 'سجّل الدخول أولاً' }); req.rid = s.restaurant_id; next(); };
const wrap = fn => (req, res) => { try { fn(req, res); } catch (e) { console.error(e); res.status(400).json({ error: e.message }); } };

app.get('/api/me', (req, res) => {
  const s = session(req);
  res.json({ restaurant_ordering: getSetting('restaurant_ordering') === '1', role: s ? s.role : null, restaurant: s && s.restaurant_id ? db.prepare('SELECT id,name FROM restaurants WHERE id=?').get(s.restaurant_id) : null, factory_name: getSetting('factory_name') });
});
app.post('/api/logout', (req, res) => { if (req.cookies.sid) db.prepare('DELETE FROM sessions WHERE token=?').run(req.cookies.sid); res.clearCookie('sid'); res.json({ ok: true }); });

const loginAttempts = new Map();
function throttled(key) { const a = loginAttempts.get(key) || { n: 0, t: Date.now() }; if (Date.now() - a.t > 10 * 60e3) { a.n = 0; a.t = Date.now(); } a.n++; loginAttempts.set(key, a); return a.n > 15; }

app.post('/api/manager/login', (req, res) => {
  if (throttled('m' + req.ip)) return res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد قليل' });
  if (!checkManagerPin(req.body.pin)) return res.status(401).json({ error: 'الرقم السري غير صحيح' });
  newSession(res, 'manager'); res.json({ ok: true });
});
app.get('/api/restaurants/public', (req, res) => res.json(db.prepare('SELECT id,name FROM restaurants WHERE active=1 ORDER BY name').all()));
app.post('/api/restaurant/login', (req, res) => {
  if (getSetting('restaurant_ordering') !== '1') return res.status(403).json({ error: 'الطلب من المطاعم غير مفعّل حالياً، تواصل مع المعمل' });
  if (throttled('r' + req.ip)) return res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد قليل' });
  const r = db.prepare('SELECT * FROM restaurants WHERE id=? AND active=1').get(Number(req.body.restaurant_id));
  if (!r || String(req.body.pin || '') !== r.pin) return res.status(401).json({ error: 'الرقم السري غير صحيح' });
  newSession(res, 'restaurant', r.id); res.json({ ok: true });
});

// ---------- shared order helpers ----------
function orderWithItems(o) {
  if (!o) return null;
  o.items = db.prepare('SELECT oi.product_id, p.name, p.unit, oi.qty, oi.price FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY p.sort, p.id').all(o.id);
  o.total = round2(o.items.reduce((s, i) => s + i.qty * i.price, 0));
  return o;
}
function saveOrder(rid, date, items, note, source) {
  const clean = (items || []).map(i => ({ product_id: Number(i.product_id), qty: Number(i.qty) })).filter(i => i.qty > 0 && i.product_id);
  return tx(() => {
    let o = db.prepare('SELECT * FROM orders WHERE restaurant_id=? AND delivery_date=?').get(rid, date);
    if (o && o.status === 'delivered') throw new Error('الطلبية تم توصيلها ولا يمكن تعديلها');
    if (!clean.length) { if (o) db.prepare('DELETE FROM orders WHERE id=?').run(o.id); return null; }
    if (!o) {
      const id = db.prepare('INSERT INTO orders(restaurant_id,delivery_date,status,note,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(rid, date, 'new', note || '', source, nowIso(), nowIso()).lastInsertRowid;
      o = { id };
    } else {
      db.prepare('UPDATE orders SET note=?, updated_at=?, status=? WHERE id=?').run(note || '', nowIso(), 'new', o.id);
      db.prepare('DELETE FROM order_items WHERE order_id=?').run(o.id);
    }
    const ins = db.prepare('INSERT INTO order_items VALUES(?,?,?,?)');
    clean.forEach(i => ins.run(o.id, i.product_id, i.qty, priceFor(rid, i.product_id)));
    return o.id;
  });
}

// ---------- restaurant API ----------
app.get('/api/r/state', requireRestaurant, (req, res) => {
  const date = nextDeliveryDate();
  const products = db.prepare('SELECT id,name,unit FROM products WHERE active=1 ORDER BY sort,id').all().map(p => ({ ...p, price: priceFor(req.rid, p.id) }));
  const current = orderWithItems(db.prepare('SELECT * FROM orders WHERE restaurant_id=? AND delivery_date=?').get(req.rid, date));
  const last = orderWithItems(db.prepare('SELECT * FROM orders WHERE restaurant_id=? AND delivery_date<? ORDER BY delivery_date DESC LIMIT 1').get(req.rid, date));
  const recent = db.prepare('SELECT * FROM orders WHERE restaurant_id=? ORDER BY delivery_date DESC LIMIT 7').all(req.rid).map(orderWithItems);
  res.json({ delivery_date: date, cutoff_time: getSetting('cutoff_time'), today: riyadhParts().date, products, current, last, recent, restaurant: db.prepare('SELECT id,name FROM restaurants WHERE id=?').get(req.rid) });
});
app.post('/api/r/order', requireRestaurant, wrap((req, res) => {
  const date = nextDeliveryDate();
  if (req.body.delivery_date && req.body.delivery_date !== date) throw new Error('انتهى وقت الطلب لهذا اليوم، حدّث الصفحة');
  saveOrder(req.rid, date, req.body.items, req.body.note, 'restaurant');
  res.json({ ok: true });
}));

// ---------- manager API ----------
app.get('/api/m/day', requireManager, (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : riyadhParts().date;
  const orders = db.prepare(`SELECT o.*, r.name AS restaurant_name, r.phone, r.address, r.map_url FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.delivery_date=? ORDER BY r.route_order, r.id`).all(date).map(orderWithItems);
  const totals = db.prepare(`SELECT p.id, p.name, p.unit, SUM(oi.qty) AS qty FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.delivery_date=? AND o.status!='cancelled' GROUP BY p.id ORDER BY p.sort, p.id`).all(date);
  res.json({ date, today: riyadhParts().date, totals, orders, day_total: round2(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)) });
});
app.post('/api/m/orders/:id/status', requireManager, wrap((req, res) => {
  const st = req.body.status; if (!['new', 'prepared', 'delivered', 'cancelled'].includes(st)) throw new Error('حالة غير صحيحة');
  db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').run(st, nowIso(), Number(req.params.id)); res.json({ ok: true });
}));
app.post('/api/m/order', requireManager, wrap((req, res) => {
  if (!isDate(req.body.delivery_date)) throw new Error('تاريخ غير صحيح');
  saveOrder(Number(req.body.restaurant_id), req.body.delivery_date, req.body.items, req.body.note, 'manager'); res.json({ ok: true });
}));
app.get('/api/m/history', requireManager, (req, res) => {
  res.json(db.prepare(`SELECT o.delivery_date AS date, COUNT(DISTINCT o.id) AS orders, SUM(CASE WHEN o.status='delivered' THEN 1 ELSE 0 END) AS delivered,
    (SELECT ROUND(SUM(oi.qty*oi.price),2) FROM order_items oi JOIN orders o2 ON o2.id=oi.order_id WHERE o2.delivery_date=o.delivery_date AND o2.status!='cancelled') AS total
    FROM orders o GROUP BY o.delivery_date ORDER BY o.delivery_date DESC LIMIT 120`).all());
});
app.get('/api/m/lookups', requireManager, (req, res) => res.json({ today: riyadhParts().date,
  products: db.prepare('SELECT id,name,unit,price FROM products WHERE active=1 ORDER BY sort,id').all(),
  restaurants: db.prepare('SELECT id,name,active FROM restaurants ORDER BY active DESC, route_order, id').all() }));
app.get('/api/m/order', requireManager, (req, res) => res.json(orderWithItems(db.prepare('SELECT * FROM orders WHERE restaurant_id=? AND delivery_date=?').get(Number(req.query.restaurant_id), req.query.date)) || null));
// products
app.get('/api/m/products', requireManager, (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY active DESC, sort, id').all()));
app.post('/api/m/products', requireManager, wrap((req, res) => {
  const { id, name, unit, price, active } = req.body; if (!name || !String(name).trim()) throw new Error('اكتب اسم الصنف');
  if (id) db.prepare('UPDATE products SET name=?, unit=?, price=?, active=? WHERE id=?').run(name.trim(), unit || 'حبة', Number(price) || 0, active ? 1 : 0, Number(id));
  else db.prepare('INSERT INTO products(name,unit,price,sort) VALUES(?,?,?,(SELECT IFNULL(MAX(sort),0)+1 FROM products))').run(name.trim(), unit || 'حبة', Number(price) || 0);
  res.json({ ok: true });
}));
// restaurants
app.get('/api/m/restaurants', requireManager, (req, res) => {
  const today = riyadhParts().date;
  const rows = db.prepare(`SELECT r.*, (SELECT MAX(delivery_date) FROM orders WHERE restaurant_id=r.id AND status!='cancelled' AND delivery_date<=?) AS last_order,
     IFNULL((SELECT SUM(oi.qty*oi.price) FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status='delivered' AND o.restaurant_id=r.id),0)
     - IFNULL((SELECT SUM(amount) FROM payments WHERE restaurant_id=r.id),0) AS balance
     FROM restaurants r ORDER BY r.active DESC, r.name`).all(addDays(today, 7));
  rows.forEach(r => { r.balance = round2(r.balance); r.days_since = r.last_order ? Math.max(0, Math.round((new Date(today) - new Date(r.last_order)) / 864e5)) : null; });
  res.json(rows);
});
app.post('/api/m/restaurants', requireManager, wrap((req, res) => {
  const { id, name, phone, address, pin, active, map_url } = req.body;
  if (!name || !String(name).trim()) throw new Error('اكتب اسم المطعم');
  if (!/^\d{4,8}$/.test(String(pin || ''))) throw new Error('الرقم السري لازم يكون من 4 إلى 8 أرقام');
  tx(() => {
    let rid = Number(id);
    if (rid) db.prepare('UPDATE restaurants SET name=?, phone=?, address=?, pin=?, active=?, map_url=? WHERE id=?').run(name.trim(), phone || '', address || '', String(pin), active ? 1 : 0, map_url || '', rid);
    else rid = Number(db.prepare('INSERT INTO restaurants(name,phone,address,pin,map_url,route_order) VALUES(?,?,?,?,?,(SELECT IFNULL(MAX(route_order),0)+1 FROM restaurants))').run(name.trim(), phone || '', address || '', String(pin), map_url || '').lastInsertRowid);
  });
  res.json({ ok: true });
}));
// settings
app.get('/api/m/settings', requireManager, (req, res) => res.json({ cutoff_time: getSetting('cutoff_time'), factory_name: getSetting('factory_name'), restaurant_ordering: getSetting('restaurant_ordering') === '1' }));
app.post('/api/m/settings', requireManager, wrap((req, res) => {
  const { cutoff_time, factory_name } = req.body;
  if (cutoff_time) { if (!/^\d{2}:\d{2}$/.test(cutoff_time)) throw new Error('وقت غير صحيح'); setSetting('cutoff_time', cutoff_time); }
  if (factory_name) setSetting('factory_name', factory_name);
  if (typeof req.body.restaurant_ordering === 'boolean') setSetting('restaurant_ordering', req.body.restaurant_ordering ? '1' : '0');
  res.json({ ok: true });
}));

// تغيير الرقم السري للمدير: الحالي + الجديد مرتين. بعد التغيير لا يُستخدم MANAGER_PIN أبداً
app.post('/api/m/pin', requireManager, wrap((req, res) => {
  const { current, new_pin, confirm } = req.body;
  if (throttled('p' + req.ip)) return res.status(429).json({ error: 'محاولات كثيرة، جرّب بعد قليل' });
  if (!checkManagerPin(current)) return res.status(400).json({ error: 'الرقم السري الحالي غير صحيح' });
  if (!/^\d{4,8}$/.test(String(new_pin || ''))) throw new Error('الرقم الجديد لازم يكون من 4 إلى 8 أرقام');
  if (String(new_pin) !== String(confirm)) throw new Error('الرقم الجديد والتأكيد مش متطابقين');
  setSetting('manager_pin', hashPin(new_pin));
  db.prepare("DELETE FROM sessions WHERE role='manager' AND token!=?").run(req.cookies.sid || ''); // تسجيل خروج الأجهزة الأخرى
  res.json({ ok: true });
}));

// ---------- finance ----------
const SALES_SQL = `SELECT o.restaurant_id, IFNULL(SUM(oi.qty*oi.price),0) AS s FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status='delivered' GROUP BY o.restaurant_id`;
app.get('/api/m/finance/balances', requireManager, (req, res) => {
  const rows = db.prepare(`SELECT r.id, r.name, r.phone,
     IFNULL((SELECT SUM(oi.qty*oi.price) FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status='delivered' AND o.restaurant_id=r.id),0) AS sales,
     IFNULL((SELECT SUM(amount) FROM payments WHERE restaurant_id=r.id),0) AS paid FROM restaurants r`).all()
    .map(r => ({ ...r, sales: round2(r.sales), paid: round2(r.paid), balance: round2(r.sales - r.paid) })).sort((a, b) => b.balance - a.balance);
  const supplier = db.prepare(`SELECT IFNULL(supplier,'') AS supplier, ROUND(SUM(amount),2) AS amount FROM expenses WHERE paid=0 GROUP BY supplier ORDER BY amount DESC`).all();
  res.json({ rows, total_outstanding: round2(rows.reduce((s, r) => s + Math.max(0, r.balance), 0)), supplier_debts: supplier, supplier_total: round2(supplier.reduce((s, x) => s + x.amount, 0)) });
});
function statement(rid, from, to) {
  const r = db.prepare('SELECT id,name,phone,address FROM restaurants WHERE id=?').get(rid); if (!r) throw new Error('مطعم غير موجود');
  const opening = round2((db.prepare(`SELECT IFNULL(SUM(oi.qty*oi.price),0) s FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status='delivered' AND o.restaurant_id=? AND o.delivery_date<?`).get(rid, from).s) - db.prepare('SELECT IFNULL(SUM(amount),0) s FROM payments WHERE restaurant_id=? AND date<?').get(rid, from).s);
  const lines = [];
  db.prepare(`SELECT * FROM orders WHERE restaurant_id=? AND status='delivered' AND delivery_date BETWEEN ? AND ? ORDER BY delivery_date`).all(rid, from, to).map(orderWithItems)
    .forEach(o => lines.push({ date: o.delivery_date, kind: 'order', desc: o.items.map(i => `${i.name} ${i.qty} ${i.unit}`).join('، '), debit: o.total, credit: 0 }));
  db.prepare('SELECT * FROM payments WHERE restaurant_id=? AND date BETWEEN ? AND ? ORDER BY date').all(rid, from, to)
    .forEach(p => lines.push({ id: p.id, date: p.date, kind: 'payment', desc: `دفعة ${p.method}${p.note ? ' - ' + p.note : ''}`, debit: 0, credit: round2(p.amount) }));
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'order' ? -1 : 1));
  let bal = opening; lines.forEach(l => { bal = round2(bal + l.debit - l.credit); l.balance = bal; });
  return { restaurant: r, from, to, opening, closing: bal, lines, factory_name: getSetting('factory_name') };
}
app.get('/api/m/finance/statement', requireManager, wrap((req, res) => {
  const to = isDate(req.query.to) ? req.query.to : riyadhParts().date;
  const from = isDate(req.query.from) ? req.query.from : addDays(to, -30);
  res.json(statement(Number(req.query.restaurant_id), from, to));
}));
app.post('/api/m/finance/payments', requireManager, wrap((req, res) => {
  const amount = Number(req.body.amount); if (!(amount > 0)) throw new Error('اكتب المبلغ');
  const date = isDate(req.body.date) ? req.body.date : riyadhParts().date;
  db.prepare('INSERT INTO payments(restaurant_id,date,amount,method,note,created_at) VALUES(?,?,?,?,?,?)').run(Number(req.body.restaurant_id), date, amount, req.body.method || 'نقدي', req.body.note || '', nowIso());
  res.json({ ok: true });
}));
app.delete('/api/m/finance/payments/:id', requireManager, (req, res) => { db.prepare('DELETE FROM payments WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
app.get('/api/m/finance/expenses', requireManager, (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : riyadhParts().date.slice(0, 7);
  res.json(db.prepare("SELECT * FROM expenses WHERE substr(date,1,7)=? ORDER BY date DESC, id DESC").all(month));
});
app.post('/api/m/finance/expenses', requireManager, wrap((req, res) => {
  const { id, date, category, amount, supplier, paid, note } = req.body;
  if (!(Number(amount) > 0)) throw new Error('اكتب المبلغ');
  const d = isDate(date) ? date : riyadhParts().date;
  if (id) db.prepare('UPDATE expenses SET date=?, category=?, amount=?, supplier=?, paid=?, note=? WHERE id=?').run(d, category || 'أخرى', Number(amount), supplier || '', paid ? 1 : 0, note || '', Number(id));
  else db.prepare('INSERT INTO expenses(date,category,amount,supplier,paid,note,created_at) VALUES(?,?,?,?,?,?,?)').run(d, category || 'أخرى', Number(amount), supplier || '', paid ? 1 : 0, note || '', nowIso());
  res.json({ ok: true });
}));
app.delete('/api/m/finance/expenses/:id', requireManager, (req, res) => { db.prepare('DELETE FROM expenses WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
app.get('/api/m/finance/summary', requireManager, (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : riyadhParts().date.slice(0, 7);
  const days = {};
  const d = k => (days[k] = days[k] || { date: k, sales: 0, collected: 0, expenses: 0 });
  db.prepare(`SELECT o.delivery_date k, SUM(oi.qty*oi.price) v FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status='delivered' AND substr(o.delivery_date,1,7)=? GROUP BY k`).all(month).forEach(r => d(r.k).sales = round2(r.v));
  db.prepare(`SELECT date k, SUM(amount) v FROM payments WHERE substr(date,1,7)=? GROUP BY k`).all(month).forEach(r => d(r.k).collected = round2(r.v));
  db.prepare(`SELECT date k, SUM(amount) v FROM expenses WHERE substr(date,1,7)=? GROUP BY k`).all(month).forEach(r => d(r.k).expenses = round2(r.v));
  const list = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
  const sum = f => round2(list.reduce((s, x) => s + x[f], 0));
  const byCat = db.prepare(`SELECT category, ROUND(SUM(amount),2) amount FROM expenses WHERE substr(date,1,7)=? GROUP BY category ORDER BY amount DESC`).all(month);
  res.json({ month, days: list, sales: sum('sales'), collected: sum('collected'), expenses: sum('expenses'), profit: round2(sum('sales') - sum('expenses')), by_category: byCat, today: riyadhParts().date });
});

// زبائن نشطين وقفوا عن الطلب من X يوم
app.get('/api/m/stopped', requireManager, (req, res) => {
  const days = Math.max(1, Number(req.query.days) || 7);
  const today = riyadhParts().date, since = addDays(today, -days);
  const rows = db.prepare(`SELECT r.id, r.name, r.phone, (SELECT MAX(delivery_date) FROM orders WHERE restaurant_id=r.id AND status!='cancelled') AS last_order
     FROM restaurants r WHERE r.active=1`).all().filter(r => !r.last_order || r.last_order < since)
     .map(r => ({ ...r, days_since: r.last_order ? Math.round((new Date(today) - new Date(r.last_order)) / 864e5) : null }))
     .sort((a, b) => (b.days_since ?? 1e9) - (a.days_since ?? 1e9));
  res.json({ days, rows });
});
app.post('/api/m/restaurants/:id/active', requireManager, (req, res) => { db.prepare('UPDATE restaurants SET active=? WHERE id=?').run(req.body.active ? 1 : 0, Number(req.params.id)); res.json({ ok: true }); });

// ترتيب خط التوصيل (ثابت لكل مطعم)
app.post('/api/m/route', requireManager, wrap((req, res) => {
  const ids = (req.body.ids || []).map(Number); const up = db.prepare('UPDATE restaurants SET route_order=? WHERE id=?');
  tx(() => ids.forEach((id, i) => up.run(i + 1, id))); res.json({ ok: true });
}));

// ---------- المواد الخام والوصفات والتكلفة والتوقعات ----------
const LINE_UNITS = { 'غرام': ['كغ', 0.001], 'كغ': ['كغ', 1], 'مل': ['لتر', 0.001], 'لتر': ['لتر', 1], 'حبة': ['حبة', 1] };
// يحوّل كمية سطر الوصفة إلى وحدة شراء المادة (مثلاً غرام ← كغ)
function toIngUnit(qty, lineUnit, ingUnit) { const u = LINE_UNITS[lineUnit]; if (!u) return qty; if (u[0] === ingUnit) return qty * u[1]; if (ingUnit === 'غرام' && u[0] === 'كغ') return qty * u[1] * 1000; if (ingUnit === 'مل' && u[0] === 'لتر') return qty * u[1] * 1000; return qty; }
function recipes() {
  const prods = db.prepare('SELECT id,name,unit,price,active FROM products ORDER BY active DESC, sort, id').all();
  return prods.map(p => {
    const lines = db.prepare('SELECT ri.ingredient_id, ri.qty, ri.unit, i.name, i.unit AS ing_unit, i.cost FROM recipe_items ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE ri.product_id=? ORDER BY i.name').all(p.id)
      .map(l => ({ ...l, line_cost: Math.round(toIngUnit(l.qty, l.unit, l.ing_unit) * l.cost * 10000) / 10000 }));
    const cost = Math.round(lines.reduce((s, l) => s + l.line_cost, 0) * 1000) / 1000;
    return { ...p, lines, cost_per_unit: cost, margin_per_unit: round2(p.price - cost) };
  });
}
app.get('/api/m/ingredients', requireManager, (req, res) => res.json(db.prepare('SELECT * FROM ingredients ORDER BY active DESC, name').all()));
app.post('/api/m/ingredients', requireManager, wrap((req, res) => {
  const { id, name, unit, cost, active } = req.body; if (!name || !String(name).trim()) throw new Error('اكتب اسم المادة');
  if (id) db.prepare('UPDATE ingredients SET name=?, unit=?, cost=?, active=? WHERE id=?').run(name.trim(), unit || 'كغ', Number(cost) || 0, active === false ? 0 : 1, Number(id));
  else db.prepare('INSERT INTO ingredients(name,unit,cost) VALUES(?,?,?)').run(name.trim(), unit || 'كغ', Number(cost) || 0);
  res.json({ ok: true });
}));
app.get('/api/m/recipes', requireManager, (req, res) => res.json(recipes()));
app.post('/api/m/recipes/:pid', requireManager, wrap((req, res) => {
  const pid = Number(req.params.pid);
  tx(() => {
    db.prepare('DELETE FROM recipe_items WHERE product_id=?').run(pid);
    const ins = db.prepare('INSERT INTO recipe_items VALUES(?,?,?,?)');
    (req.body.lines || []).filter(l => Number(l.ingredient_id) && Number(l.qty) > 0).forEach(l => ins.run(pid, Number(l.ingredient_id), Number(l.qty), LINE_UNITS[l.unit] ? l.unit : 'غرام'));
  });
  res.json({ ok: true });
}));
// المواد المطلوبة لطلبيات يوم + تكلفة الإنتاج + اقتراح كميات حسب نفس اليوم من الأسابيع الماضية
app.get('/api/m/forecast', requireManager, (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : addDays(riyadhParts().date, 1);
  const R = recipes(); const byId = Object.fromEntries(R.map(r => [r.id, r]));
  const totals = db.prepare(`SELECT oi.product_id, SUM(oi.qty) qty, SUM(oi.qty*oi.price) value FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.delivery_date=? AND o.status!='cancelled' GROUP BY oi.product_id`).all(date);
  const needs = {}; let cost = 0, value = 0;
  totals.forEach(t => { const r = byId[t.product_id]; if (!r) return; value += t.value; cost += t.qty * r.cost_per_unit;
    r.lines.forEach(l => { const n = needs[l.ingredient_id] = needs[l.ingredient_id] || { name: l.name, unit: l.ing_unit, amount: 0, cost: 0 }; n.amount += toIngUnit(l.qty, l.unit, l.ing_unit) * t.qty; n.cost += l.line_cost * t.qty; }); });
  const past = [1, 2, 3, 4].map(w => addDays(date, -7 * w));
  const sugg = R.filter(r => r.active).map(r => {
    const q = past.map(d => (db.prepare(`SELECT SUM(oi.qty) q FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.delivery_date=? AND o.status!='cancelled' AND oi.product_id=?`).get(d, r.id).q) || 0);
    const have = q.filter(x => x > 0); return { product_id: r.id, name: r.name, unit: r.unit, avg: have.length ? Math.round(have.reduce((a, b) => a + b, 0) / have.length) : 0, weeks: have.length,
      ordered: (totals.find(t => t.product_id === r.id) || {}).qty || 0 };
  });
  res.json({ date, needs: Object.values(needs).map(n => ({ ...n, amount: Math.round(n.amount * 1000) / 1000, cost: round2(n.cost) })).sort((a, b) => b.cost - a.cost),
    production_cost: round2(cost), sales_value: round2(value), profit: round2(value - cost), suggestions: sugg, products: totals.map(t => ({ ...t, name: (byId[t.product_id] || {}).name, unit: (byId[t.product_id] || {}).unit, cost_per_unit: (byId[t.product_id] || {}).cost_per_unit })) });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`food-factory listening on :${PORT}`));
