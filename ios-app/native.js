// طبقة صغيرة لتطبيق iOS فقط (ما بتنضاف لنسخة الويب على GitHub Pages)
// بتوصل ميزات الويب بميزات iPhone الأصلية: مشاركة، حفظ بالملفات، إشعارات محلية، اهتزاز، موقع.
(function () {
  if (!/TalabiyatIOS|TalabiyatAndroid/.test(navigator.userAgent)) return;
  window.__NATIVE_APP = true;
  try { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); } catch (_) {}
  // تعرّف الكلام: نستعمل مايك الكيبورد (إملاء iPhone) بدل إذن الميكروفون
  try { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; } catch (_) {}
  function cap() { return window.Capacitor && window.Capacitor.nativePromise ? window.Capacitor : null; }
  function call(plugin, method, opts) { return cap().nativePromise(plugin, method, opts || {}); }
  function has(plugin) { var c = cap(); return !!(c && (!c.isPluginAvailable || c.isPluginAvailable(plugin))); }
  function b64(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(file); });
  }

  // 1) المشاركة (نسخة احتياطية / إرسال الطلبيات / كشف حساب) عبر نافذة المشاركة الأصلية
  navigator.canShare = function (d) { return !!cap() && !!d; };
  navigator.share = async function (d) {
    if (!cap()) throw new DOMException('no bridge', 'NotSupportedError');
    d = d || {};
    var files = [];
    if (d.files && d.files.length) {
      for (var i = 0; i < d.files.length; i++) {
        var f = d.files[i];
        var w = await call('Filesystem', 'writeFile', { path: f.name || ('file' + i), data: await b64(f), directory: 'CACHE' });
        files.push(w.uri);
      }
    }
    try {
      await call('Share', 'share', { title: d.title || undefined, text: d.text || undefined, url: d.url || undefined, files: files.length ? files : undefined, dialogTitle: d.title || 'مشاركة' });
    } catch (e) {
      var m = String((e && e.message) || e);
      if (/cancel/i.test(m)) throw new DOMException('cancel', 'AbortError');
      throw e;
    }
  };
  // الطباعة: نشارك النص (ومن نافذة المشاركة في iPhone في خيار «طباعة»)
  window.print = function () {
    var el = document.querySelector('#app'); var t = el ? el.innerText : document.body.innerText;
    navigator.share({ title: 'طلبيات', text: t }).catch(function () {});
  };

  // 2) الموقع الحالي عبر خدمة الموقع الأصلية (نافذة إذن وحدة بالعربي)
  if (has('Geolocation')) {
    var geo = {
      getCurrentPosition: function (ok, err, o) {
        o = o || {};
        call('Geolocation', 'getCurrentPosition', { enableHighAccuracy: !!o.enableHighAccuracy, timeout: o.timeout || 10000, maximumAge: o.maximumAge || 0 })
          .then(function (p) { ok && ok({ coords: p.coords, timestamp: p.timestamp }); })
          .catch(function (e) { err && err({ code: 1, message: String((e && e.message) || e) }); });
      },
      watchPosition: function () { return 0; }, clearWatch: function () {}
    };
    try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (_) {}
  }

  // 3) إشعارات «أحمد» عن المخزون: إشعار محلي أصلي (ما في سيرفر ولا push)
  if (has('LocalNotifications')) {
    var perm = 'default', nid = 1;
    call('LocalNotifications', 'checkPermissions').then(function (r) { perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; }).catch(function () {});
    var N = function (title, o) {
      o = o || {};
      call('LocalNotifications', 'schedule', { notifications: [{ id: (nid++ % 100000) + 1, title: String(title || ''), body: String(o.body || '') }] }).catch(function () {});
    };
    Object.defineProperty(N, 'permission', { get: function () { return perm; } });
    N.requestPermission = function () {
      return call('LocalNotifications', 'requestPermissions').then(function (r) { perm = r.display === 'granted' ? 'granted' : 'denied'; return perm; }).catch(function () { return perm; });
    };
    window.Notification = N;
  }

  // 4) اهتزاز خفيف مع رسائل التأكيد (تم الحفظ ✅ …)
  if (has('Haptics')) {
    window.addEventListener('DOMContentLoaded', function () {
      var t = window.toast; if (typeof t !== 'function') return;
      window.toast = function (msg) {
        try { var s = String(msg || ''); call('Haptics', s.indexOf('✅') >= 0 ? 'notification' : 'impact', s.indexOf('✅') >= 0 ? { type: 'SUCCESS' } : { style: 'LIGHT' }).catch(function () {}); } catch (_) {}
        return t.apply(this, arguments);
      };
    });
  }
  // 5) رابط «سياسة الخصوصية» داخل التطبيق (صفحة «المزيد») — Apple بتطلبه (5.1.1)
  function privacy() {
    if (document.getElementById('np_ov')) return;
    var ov = document.createElement('div'); ov.id = 'np_ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column';
    ov.innerHTML = '<div style="background:#3D6B2B;color:#fff;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:19px"><span>🔒 سياسة الخصوصية</span><button id="np_x" style="background:#fff;color:#3D6B2B;border:0;border-radius:10px;padding:8px 16px;font-size:18px;font-weight:700">رجوع</button></div><iframe src="privacy.html" style="flex:1;border:0;width:100%"></iframe>';
    document.body.appendChild(ov);
    document.getElementById('np_x').onclick = function () { ov.remove(); };
  }
  window.__openPrivacy = privacy;
  window.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('app') || document.body;
    new MutationObserver(function () {
      var h = document.getElementById('more_help');
      if (!h || document.getElementById('np_priv')) return;
      var a = document.createElement('button'); a.type = 'button'; a.id = 'np_priv'; a.className = 'btn block sec'; a.textContent = '🔒 سياسة الخصوصية';
      a.onclick = privacy; h.parentNode.appendChild(a);
    }).observe(root, { childList: true, subtree: true });
  });

  // 6) بيانات تجريبية (اختيارية): زر على الشاشة الفاضية بس — ما بتنضاف لحالها أبداً، وبتنحذف بضغطة
  var DEMO_KEY = 'talabiyat_demo_snapshot';
  function dbNow() { try { return JSON.parse(window.Store.exportJson()); } catch (_) { return null; } }
  function isEmpty(d) { return d && !d.restaurants.length && !d.orders.length && !d.ingredients.length && !d.payments.length && !d.expenses.length; }
  async function loadDemo() {
    var before = dbNow(); if (!isEmpty(before)) { window.toast && toast('في بيانات حقيقية — ما بنضيف تجريبي'); return; }
    if (!confirm('بنضيف بيانات تجريبية (زبائن وطلبيات ومخزون) عشان تشوف كيف التطبيق بشتغل.\nبتقدر تحذفها كلها بضغطة من الشريط اللي فوق.\n\nLoad demo data? You can remove it with one tap.')) return;
    localStorage.setItem(DEMO_KEY, JSON.stringify(before));
    var A = window.Store.api, T = window.Store.today();
    var add = function (d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    try {
      var P = (await A('/api/m/lookups')).products;
      var pid = function (i) { return P[i] ? P[i].id : null; };
      if (P.length < 2) { await A('/api/m/products', { name: 'ورق العنب', unit: 'حبة', price: 0.5 }); await A('/api/m/products', { name: 'الملفوف', unit: 'حبة', price: 0.6 }); P = (await A('/api/m/lookups')).products; }
      await A('/api/m/products', { name: 'الكبة', unit: 'حبة', price: 1.5 });
      P = (await A('/api/m/lookups')).products;
      var R = [['مطعم الأصيل (تجريبي)', 24.7136, 46.6753, '0500000001'], ['مطعم السرايا (تجريبي)', 24.7292, 46.6512, '0500000002'], ['البيت الشامي (تجريبي)', 24.6981, 46.7012, '0500000003'], ['ليالي حلب (تجريبي)', 24.7420, 46.6900, '0500000004']];
      for (var i = 0; i < R.length; i++) await A('/api/m/restaurants', { name: R[i][0], lat: R[i][1], lng: R[i][2], phone: R[i][3], address: 'عنوان تجريبي' });
      var rest = (await A('/api/m/lookups')).restaurants.map(function (r) { return r.id; });
      var ing = [['ورق عنب', 'كغ', 150, 20, 'كغ'], ['أرز مصري', 'كغ', 95, 10, 'كغ'], ['لحم مفروم', 'كغ', 42, 1, 'كغ'], ['ملفوف', 'كغ', 6, 1, 'كغ']];
      for (i = 0; i < ing.length; i++) await A('/api/m/ingredients', { name: ing[i][0], unit: ing[i][1], buy_price: ing[i][2], buy_qty: ing[i][3], buy_unit: ing[i][4] });
      var after = dbNow(), I = after.ingredients.map(function (x) { return x.id; });
      await A('/api/m/recipes/' + pid(0), { lines: [{ ingredient_id: I[0], qty: 6, unit: 'غرام' }, { ingredient_id: I[1], qty: 8, unit: 'غرام' }] });
      await A('/api/m/recipes/' + pid(1), { lines: [{ ingredient_id: I[3], qty: 15, unit: 'غرام' }, { ingredient_id: I[2], qty: 5, unit: 'غرام' }] });
      for (var d = -6; d <= 1; d++) {
        var date = add(T, d);
        for (var r = 0; r < rest.length; r++) {
          if (d < 0 && (d + r) % 3 === 0) continue;
          var items = [{ product_id: pid(0), qty: 100 + ((r * 37 + d * 11 + 400) % 4 + 1) * 50 }, { product_id: pid(1), qty: 50 + (r % 3) * 50 }];
          if (r % 2 === 0 && pid(2)) items.push({ product_id: pid(2), qty: 40 + r * 10 });
          await A('/api/m/order', { restaurant_id: rest[r], delivery_date: date, items: items, note: d === 0 && r === 1 ? 'ملاحظة تجريبية' : '' });
        }
        if (d < 0) { var D = await A('/api/m/day?date=' + date); for (var k = 0; k < D.orders.length; k++) await A('/api/m/orders/' + D.orders[k].id + '/status', { status: 'delivered' }); }
      }
      for (r = 0; r < rest.length; r++) await A('/api/m/finance/payments', { restaurant_id: rest[r], amount: 300 + r * 150, date: add(T, -2), method: 'نقدي' });
      await A('/api/m/finance/expenses', { date: add(T, -2), category: 'مواد خام', amount: 640, supplier: 'مورد تجريبي', paid: true });
      var st = [70, 30, 4, 45];
      for (i = 0; i < I.length; i++) await A('/api/m/stock/' + I[i], { kind: 'count', qty: st[i], date: T });
      await A('/api/m/backup-done', {});
    } catch (e) { console.error(e); }
    location.hash = '#/day'; location.reload();
  }
  async function removeDemo() {
    var snap = localStorage.getItem(DEMO_KEY); if (!snap) return;
    if (!confirm('نحذف كل البيانات التجريبية ونرجع التطبيق فاضي؟\n(أي اشي ضفته بعد التجربة كمان رح ينحذف)\n\nRemove all demo data?')) return;
    try { await window.Store.api('/api/m/restore', { data: JSON.parse(snap) }); } catch (e) { alert(String((e && e.message) || e)); return; }
    localStorage.removeItem(DEMO_KEY); location.hash = '#/day'; location.reload();
  }
  window.__loadDemo = loadDemo; window.__removeDemo = removeDemo;

  // 7) تذكير يومي أصلي (إشعار محلي متكرر الساعة 8 المسا): «جهّز طلبيات بكرة»
  var REM_KEY = 'talabiyat_daily_reminder', REM_ID = 9001;
  function remOn() { return localStorage.getItem(REM_KEY) === '1'; }
  async function toggleReminder(btn) {
    try {
      if (remOn()) {
        await call('LocalNotifications', 'cancel', { notifications: [{ id: REM_ID }] });
        localStorage.removeItem(REM_KEY);
      } else {
        var p = await call('LocalNotifications', 'requestPermissions');
        if (p.display !== 'granted') { alert('اسمح بالإشعارات من الإعدادات ← طلبيات ← الإشعارات'); return; }
        await call('LocalNotifications', 'schedule', { notifications: [{ id: REM_ID, title: 'طلبيات 📋', body: 'جهّز طلبيات بكرة وشوف المخزون', schedule: { on: { hour: 20, minute: 0 }, allowWhileIdle: true } }] });
        localStorage.setItem(REM_KEY, '1');
      }
      tap(); if (window.toast) toast(remOn() ? '⏰ التذكير اليومي شغّال (8 المسا) ✅' : 'التذكير اليومي انطفى');
    } catch (e) { alert(String((e && e.message) || e)); }
    if (btn) btn.textContent = remLabel();
  }
  function remLabel() { return remOn() ? '⏰ التذكير اليومي (8 المسا): شغّال — اضغط للإطفاء' : '⏰ ذكّرني كل يوم 8 المسا بطلبيات بكرة'; }

  // 8) خلفية الخريطة (OpenStreetMap) مطفأة افتراضياً — ما بنتصل بأي سيرفر إلا لما تشغّلها
  var TILE_KEY = 'talabiyat_map_tiles';
  function tilesOn() { return localStorage.getItem(TILE_KEY) === '1'; }
  function wrapLeaflet(L) {
    if (!L || L.__np) return; L.__np = true;
    var orig = L.tileLayer;
    L.tileLayer = function () {
      var t = orig.apply(L, arguments), oa = t.addTo.bind(t);
      t.addTo = function (m) {
        if (tilesOn()) return oa(m);
        var c = m.getContainer(), b = document.createElement('button');
        b.type = 'button'; b.className = 'btn sm';
        b.style.cssText = 'position:absolute;z-index:1000;left:50%;top:50%;transform:translate(-50%,-50%);max-width:85%;white-space:normal';
        b.textContent = '🗺️ اعرض خلفية الخريطة (بتنحمّل من OpenStreetMap)';
        if (L.DomEvent) { L.DomEvent.disableClickPropagation(b); }
        b.onclick = function (e) { e.stopPropagation(); localStorage.setItem(TILE_KEY, '1'); oa(m); b.remove(); };
        c.appendChild(b); return t;
      };
      return t;
    };
  }
  var _L;
  try { Object.defineProperty(window, 'L_', { configurable: true, get: function () { return _L; }, set: function (v) { _L = v; try { wrapLeaflet(v); } catch (_) {} } }); } catch (_) {}
  function tileLabel() { return tilesOn() ? '🗺️ خلفية الخريطة: شغّالة — اضغط للإطفاء' : '🗺️ خلفية الخريطة: مطفأة (بدون اتصال بأي سيرفر)'; }

  // 9) اهتزاز خفيف لما تتنقل بين التبويبات
  function tap() { if (has('Haptics')) call('Haptics', 'impact', { style: 'LIGHT' }).catch(function () {}); }
  window.addEventListener('hashchange', tap);

  // أزرار الشاشة الفاضية + شريط التجربة + إعدادات «المزيد»
  function decorate() {
    var rs = document.getElementById('rs_first');
    if (rs && !document.getElementById('np_demo') && !localStorage.getItem(DEMO_KEY) && isEmpty(dbNow())) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'np_demo'; b.className = 'btn sm';
      b.textContent = '🧪 تجربة ببيانات تجريبية (Demo)'; b.onclick = loadDemo;
      rs.parentNode.appendChild(b);
    }
    var app = document.getElementById('app');
    if (app && localStorage.getItem(DEMO_KEY) && !document.getElementById('np_demobar')) {
      var bar = document.createElement('div'); bar.id = 'np_demobar'; bar.className = 'card';
      bar.style.cssText = 'background:#fff4cc;border:1px solid #e0c35a;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap';
      bar.innerHTML = '<b>🧪 هاي بيانات تجريبية (Demo data)</b>';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'btn sec sm'; x.textContent = '🗑️ احذف التجريبي'; x.onclick = removeDemo;
      bar.appendChild(x); app.insertBefore(bar, app.firstChild);
    }
    var h = document.getElementById('more_help');
    if (h && !document.getElementById('np_rem') && has('LocalNotifications')) {
      var r = document.createElement('button'); r.type = 'button'; r.id = 'np_rem'; r.className = 'btn block sec'; r.textContent = remLabel();
      r.onclick = function () { toggleReminder(r); }; h.parentNode.appendChild(r);
    }
    if (h && !document.getElementById('np_tiles')) {
      var t = document.createElement('button'); t.type = 'button'; t.id = 'np_tiles'; t.className = 'btn block sec'; t.textContent = tileLabel();
      t.onclick = function () { if (tilesOn()) localStorage.removeItem(TILE_KEY); else localStorage.setItem(TILE_KEY, '1'); t.textContent = tileLabel(); tap(); };
      h.parentNode.appendChild(t);
    }
  }
  window.addEventListener('DOMContentLoaded', function () {
    new MutationObserver(decorate).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    decorate();
  });
})();
