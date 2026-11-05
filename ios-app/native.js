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

  // 10) 🧪 فهم الطلبية بالذكاء — بثلاث طبقات، والتطبيق بيشتغل كامل بدونها:
  //   أ) الذكاء بالإنترنت عبر سيرفرنا الوسيط (Gemini أو Claude حسب السيرفر؛ بس بعد موافقة صريحة) — الأفضل بالعربي
  //   ب) نموذج Apple على الجهاز (iOS 26+، مجاني، بدون إنترنت) — لما يدعم اللغة
  //   ج) الفهم العادي parser.js — دايماً موجود
  // مطفأة افتراضياً. بتنشغل من «المزيد ← 🧪 الذكاء».
  var CLOUD = { url: '', token: '' }; // url بينعبّى بعد نشر ai-worker؛ token اختياري مع Gemini (شوف ai-worker/README.md)
  var AI_KEY = 'talabiyat_ai_parse', AI_LOG = 'talabiyat_ai_log', CLOUD_OK = 'talabiyat_ai_cloud_consent';
  var hasAI = has('TalabiyatAI'), hasCloud = !!CLOUD.url, aiStatus = null;
  function aiOn() { return localStorage.getItem(AI_KEY) === '1'; }
  function cloudOk() { return hasCloud && localStorage.getItem(CLOUD_OK) === '1'; }
  function anyAI() { return hasAI || hasCloud; }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var AI_REASON = {
    ok: '✅ جاهز على هالجهاز',
    ios_too_old: '❌ بدها iOS 26 أو أحدث',
    device_not_eligible: '❌ الجهاز ما بيدعم Apple Intelligence (بدها iPhone 15 Pro أو أحدث)',
    apple_intelligence_off: '⚠️ شغّل Apple Intelligence من الإعدادات ← Apple Intelligence و Siri',
    model_not_ready: '⏳ النموذج لسا عم ينزل على الجهاز، جرّب بعد شوي',
    sdk_without_foundation_models: '❌ النسخة مبنية بدون دعم النموذج',
    unavailable: '❌ مش متوفر حالياً'
  };
  var AI_ERR = {
    unsupported_language: 'لغة الجهاز أو النص مش مدعومة من نموذج Apple',
    guardrail: 'النموذج رفض النص', refused: 'النموذج رفض النص',
    too_long: 'النص طويل كتير',
    model_unavailable: 'نموذج Apple مش متوفر',
    timeout: 'الذكاء طوّل كتير',
    offline: 'ما في إنترنت',
    rate_limited: 'طلبات كتير ورا بعض، استنى دقيقة',
    unauthorized: 'إعداد السيرفر غلط', server_key_invalid: 'مفتاح الذكاء بالسيرفر غلط',
    no_engine: 'ما في ذكاء متاح'
  };
  var ENGINE_LABEL = { cloud: '☁️ الذكاء بالإنترنت', apple: '📱 Apple' };
  // مين المزوّد؟ السيرفر بيقول (عشان شاشة الموافقة تسمّيه صح)
  var PROVIDERS = {
    gemini: { name: 'Google Gemini', co: 'Google', extra: 'بالخدمة المجانية، Google ممكن تستعمل هالنصوص لتحسين خدماتها، وممكن يقرأها موظفين عندها للمراجعة. لا تكتب بالطلبية أشياء خاصة متل أرقام بطاقات أو كلمات سر.', link: 'https://ai.google.dev/gemini-api/terms' },
    claude: { name: 'Claude', co: 'Anthropic', extra: 'Anthropic ما بتستعمل هالبيانات لتدريب نماذجها.', link: 'https://www.anthropic.com/legal/privacy' }
  };
  var cloudProvider = null;
  function getProvider() {
    if (cloudProvider || !hasCloud) return Promise.resolve(cloudProvider);
    return fetch(CLOUD.url.replace(/\/$/, '') + '/health').then(function (r) { return r.json(); })
      .then(function (j) { cloudProvider = PROVIDERS[j.provider] ? j.provider : null; return cloudProvider; }).catch(function () { return null; });
  }
  function getAIStatus() {
    if (!hasAI) return Promise.resolve({ available: false, reason: 'unavailable' });
    return call('TalabiyatAI', 'status').then(function (s) { aiStatus = s; return s; }).catch(function () { return { available: false, reason: 'unavailable' }; });
  }
  function errCode(e) { var m = String((e && (e.code || e.message || e.errorMessage)) || e || ''); for (var k in AI_ERR) if (m.indexOf(k) >= 0) return k; return 'generation_failed'; }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }

  async function cloudParse(text, products, rests) {
    if (!navigator.onLine) throw new Error('offline');
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    try {
      var r = await fetch(CLOUD.url.replace(/\/$/, '') + '/parse-order', {
        method: 'POST', signal: ctl ? ctl.signal : undefined,
        headers: CLOUD.token ? { 'Content-Type': 'application/json', 'X-App-Token': CLOUD.token } : { 'Content-Type': 'application/json' },
        // بس الأسماء والأرقام — ما في تلفونات ولا عناوين ولا حسابات
        body: JSON.stringify({ text: text, products: products.map(function (p) { return { id: p.id, name: p.name, unit: p.unit }; }), restaurants: rests.map(function (x) { return { id: x.id, name: x.name }; }) })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || ('http_' + r.status));
      return j;
    } catch (e) { if (e && e.name === 'AbortError') throw new Error('timeout'); throw e; }
    finally { clearTimeout(t); }
  }
  function appleParse(text, products, rests) {
    return withTimeout(call('TalabiyatAI', 'parseOrder', { text: text, products: products.map(function (p) { return { id: p.id, name: p.name, unit: p.unit }; }), restaurants: rests.map(function (x) { return { id: x.id, name: x.name }; }) }), 25000);
  }
  // ينادي أحسن طبقة متاحة ويحوّل الجواب لنفس شكل OrderParser.parse. لو كلهم فشلوا بيرمي آخر خطأ.
  async function aiParse(text, only) {
    var Lk = await window.Store.api('/api/m/lookups');
    var products = Lk.products, rests = Lk.restaurants.filter(function (r) { return r.active; });
    var order = only ? [only] : [];
    if (!only) {
      if (cloudOk() && navigator.onLine) order.push('cloud');
      if (hasAI) { var st = aiStatus || await getAIStatus(); if (st.available) order.push('apple'); }
    }
    if (!order.length) throw new Error('no_engine');
    var res = null, engine = null, lastErr = null;
    for (var i = 0; i < order.length && !res; i++) {
      try { res = order[i] === 'cloud' ? await cloudParse(text, products, rests) : await appleParse(text, products, rests); engine = order[i]; }
      catch (e) { lastErr = e; }
    }
    if (!res) throw lastErr || new Error('no_engine');
    var pIds = {}, rIds = {}; products.forEach(function (p) { pIds[p.id] = p; }); rests.forEach(function (r) { rIds[r.id] = r; });
    var drafts = (res.drafts || []).map(function (d) {
      var items = {}, units = {};
      (d.lines || []).forEach(function (l) {
        if (!pIds[l.productId]) return;
        var q = Number(l.quantity); if (!isFinite(q) || q < 0) q = 0;
        items[l.productId] = (items[l.productId] || 0) + q;
        if (l.inKilo) units[l.productId] = 'كغ';
      });
      var rid = rIds[d.restaurantId] && nameInText(rIds[d.restaurantId].name, text) ? d.restaurantId : null;
      return { restaurant_id: rid, items: items, units: units, note: cleanNote(d.note), matched: Object.keys(items).length > 0 };
    }).filter(function (d) { return d.restaurant_id || d.matched; });
    var day = Number(res.dayOffset);
    return { date_offset: day >= 0 && day <= 2 ? day : null, drafts: drafts, ms: res.ms || 0, engine: engine, products: products, rests: rests };
  }
  // النموذج أحياناً بيخترع زبون: منقبل الزبون بس إذا جزء مميّز من اسمه موجود فعلاً بنص الطلبية
  var NAME_STOP = /^(مطعم|مطاعم|محل|مطبخ|كافيه|كوفي|تجريبي|demo|ال)$/;
  function nameInText(name, text) {
    var N = window.OrderParser && window.OrderParser.norm; if (!N) return true;
    var t = ' ' + N(text) + ' ';
    var parts = N(name).replace(/[()]/g, ' ').split(' ').map(function (w) { return w.replace(/^(ال|وال|بال|لل)(?=...)/, ''); })
      .filter(function (w) { return w.length >= 3 && !NAME_STOP.test(w); });
    if (!parts.length) return true;
    return parts.some(function (w) { return t.indexOf(w) >= 0; });
  }
  // الملاحظة ما لازم تكون بس يوم التوصيل (بكرة/اليوم…)
  function cleanNote(note) {
    var s = String(note || '').trim().slice(0, 200);
    var N = window.OrderParser && window.OrderParser.norm;
    var rest = N ? N(s).replace(/(^| )(بعد )?(بكره|بكرا|بكرة|غدا|الغد|اليوم)( |$)/g, ' ').trim() : s;
    return rest ? s : '';
  }
  function logAI(entry) {
    try { var a = JSON.parse(localStorage.getItem(AI_LOG) || '[]'); a.unshift(entry); localStorage.setItem(AI_LOG, JSON.stringify(a.slice(0, 30))); } catch (_) {}
  }
  // نعترض ضغطة «التالي» قبل manager.js (مرحلة الالتقاط)، ولو الذكاء فشل منكمّل عادي
  var bypass = false;
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#parse');
    if (!btn || bypass || !anyAI() || !aiOn()) return;
    var ta = document.getElementById('otext'), text = ta ? ta.value.trim() : '';
    if (!text) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var label = btn.textContent; btn.disabled = true; btn.textContent = '⏳ عم يفهم الطلبية…';
    function go(result) {
      btn.disabled = false; btn.textContent = label;
      var orig = window.OrderParser.parse;
      if (result) window.OrderParser.parse = function () { window.OrderParser.parse = orig; return result; };
      bypass = true; try { btn.click(); } finally { bypass = false; window.OrderParser.parse = orig; }
    }
    aiParse(text).then(function (r) {
      var classic = window.OrderParser.parse(text, r.products, r.rests);
      logAI({ t: Date.now(), text: text, engine: r.engine, ms: r.ms, ai: r.drafts, classic: classic.drafts });
      if (!r.drafts.length) { window.toast && toast('🧪 الذكاء ما فهم الطلبية — استعملت الفهم العادي'); return go(null); }
      go({ date_offset: r.date_offset, drafts: r.drafts });
    }).catch(function (err) {
      var c = errCode(err); logAI({ t: Date.now(), text: text, error: c });
      if (c !== 'no_engine' && window.toast) toast('🧪 ' + (AI_ERR[c] || 'الذكاء ما زبط') + ' — استعملت الفهم العادي');
      go(null);
    });
  }, true);

  // موافقة صريحة قبل ما نبعت أي شي برا الجوال (Apple 5.1.2)
  async function askCloudConsent() {
    var pv = PROVIDERS[await getProvider()];
    if (!pv) { alert('ما قدرت أوصل لسيرفر الذكاء. تأكد من الإنترنت وجرّب كمان مرة.'); return false; }
    return new Promise(function (resolve) {
      var ov = document.createElement('div'); ov.id = 'ai_consent';
      ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center';
      ov.innerHTML = '<div style="background:#fff;width:100%;max-width:560px;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));max-height:90%;overflow:auto">' +
        '<div style="font-size:21px;font-weight:800;margin-bottom:8px">☁️ فهم الطلبية بالذكاء</div>' +
        '<div style="line-height:1.8">لما تكبس «التالي»، التطبيق بيبعت عبر الإنترنت لخدمة <b>' + h(pv.name) + '</b> من شركة <b>' + h(pv.co) + '</b> (عن طريق سيرفر وسيط تبع التطبيق):<ul style="margin:6px 0;padding-inline-start:20px">' +
        '<li>نص الطلبية اللي كتبته أو حكيته</li><li>أسماء الأصناف وأسماء الزبائن (بدون تلفونات ولا عناوين ولا مبالغ)</li></ul>' +
        'الهدف بس فهم الطلبية. سيرفرنا ما بيخزّن شي. ' + h(pv.extra) + ' <span class="mut" dir="ltr">' + h(pv.link) + '</span><br>' +
        'الحسابات والمخزون وكل باقي البيانات بتضل على الجوال.<br><span class="mut">بتقدر تطفيها بأي وقت من نفس الشاشة.</span></div>' +
        '<button class="btn block" id="ai_c_yes" style="margin-top:12px">موافق، شغّلها</button>' +
        '<button class="btn block sec" id="ai_c_no" style="margin-top:8px">لا، خليها على الجهاز بس</button></div>';
      document.body.appendChild(ov);
      document.getElementById('ai_c_yes').onclick = function () { ov.remove(); resolve(true); };
      document.getElementById('ai_c_no').onclick = function () { ov.remove(); resolve(false); };
    });
  }

  // شاشة الذكاء: الحالة + تشغيل/إطفاء + الموافقة + مقارنة مع الفهم العادي على نفس النص
  function draftsHtml(drafts, products, rests) {
    if (!drafts || !drafts.length) return '<div class="mut">ما فهم شي</div>';
    var pn = {}, rn = {}; products.forEach(function (p) { pn[p.id] = p; }); rests.forEach(function (r) { rn[r.id] = r.name; });
    return drafts.map(function (d) {
      var it = Object.keys(d.items || {}).map(function (pid) { var p = pn[pid] || { name: '?', unit: '' }; return h(p.name) + ': <b>' + h(d.items[pid]) + '</b> ' + h(d.units && d.units[pid] === 'كغ' ? 'كغ' : p.unit); }).join('<br>');
      return '<div style="margin:6px 0;padding:8px;border:1px solid #ddd;border-radius:10px"><b>🏪 ' + h(d.restaurant_id ? rn[d.restaurant_id] : '— بدون مطعم —') + '</b><br>' + (it || '<span class="mut">بدون أصناف</span>') + (d.note ? '<br>📝 ' + h(d.note) : '') + '</div>';
    }).join('');
  }
  function dayTxt(o) { return o == null ? 'ما انذكر' : ['اليوم', 'بكرة', 'بعد بكرة'][o] || String(o); }
  async function openAILab() {
    if (document.getElementById('ai_ov')) return;
    var s = hasAI ? await getAIStatus() : null;
    var ov = document.createElement('div'); ov.id = 'ai_ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;overflow:auto';
    var log = []; try { log = JSON.parse(localStorage.getItem(AI_LOG) || '[]'); } catch (_) {}
    var stats = log.reduce(function (a, x) { if (x.error) a.err++; else a.ok++; return a; }, { ok: 0, err: 0 });
    var canRun = (s && s.available) || cloudOk();
    ov.innerHTML = '<div style="background:#3D6B2B;color:#fff;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:19px;position:sticky;top:0"><span>🧪 الذكاء (تجريبي)</span><button id="ai_x" style="background:#fff;color:#3D6B2B;border:0;border-radius:10px;padding:8px 16px;font-size:18px;font-weight:700">رجوع</button></div>' +
      '<div style="padding:14px">' +
      '<button class="btn block ' + (aiOn() ? '' : 'sec') + '" id="ai_tg">' + (aiOn() ? '🧪 فهم الطلبية بالذكاء: شغّال — اضغط للإطفاء' : '🧪 شغّل فهم الطلبية بالذكاء') + '</button>' +
      (hasCloud ? '<div class="card" style="margin-top:10px"><b>☁️ الذكاء بالإنترنت</b> — ' + (cloudOk() ? '✅ مسموح' : '⛔ مش مسموح') +
        '<div class="mut" style="margin-top:4px">الأفضل بفهم العربي واللهجات. بيبعت نص الطلبية وأسماء الأصناف والزبائن بس.</div>' +
        '<button class="btn sec sm" id="ai_cloud" style="margin-top:8px">' + (cloudOk() ? 'وقّف الذكاء بالإنترنت' : 'اسمح بالذكاء بالإنترنت') + '</button></div>' : '') +
      (hasAI ? '<div class="card" style="margin-top:10px"><b>📱 Apple (على الجهاز)</b> — ' + h(s.available && !s.arabic ? '⚠️ موجود، بس لسا ما بيدعم العربي (Apple ما ضافته)' : (AI_REASON[s.reason] || s.reason)) +
        '<div class="mut" style="margin-top:4px">مجاني وبدون إنترنت. iOS ' + h(s.ios || '?') + ' · لغة الجهاز: ' + h(s.locale || '?') + ' · العربي: ' + (s.arabic ? '✅' : '❌') + '</div>' +
        (s.languages && s.languages.length ? '<details style="margin-top:6px"><summary class="mut">اللغات المدعومة (' + s.languages.length + ')</summary><div class="mut" dir="ltr">' + h(s.languages.join(', ')) + '</div></details>' : '') + '</div>' : '') +
      '<div class="mut" style="margin-top:8px">الترتيب: الذكاء بالإنترنت إذا مسموح وفي إنترنت، بعدين Apple إذا متوفر، وإلا الفهم العادي. التطبيق بيشتغل كامل بدون أي واحد منهم.</div>' +
      '<h2>قارن على نص</h2><textarea id="ai_t" rows="3" placeholder="مثال: السرايا ميتين ورق عنب و ١٠٠ ملفوف بكرة"></textarea>' +
      '<button class="btn block" id="ai_go" style="margin-top:8px"' + (canRun ? '' : ' disabled') + '>قارن ▶</button>' + (canRun ? '' : '<div class="mut center">شغّل الذكاء بالإنترنت أو Apple أول</div>') + '<div id="ai_out"></div>' +
      '<div class="mut" style="margin-top:14px">سجل التجارب على هالجهاز: ' + stats.ok + ' نجحت · ' + stats.err + ' فشلت</div>' +
      (log.length ? '<button class="btn sec sm" id="ai_share" style="margin-top:6px">📤 شارك السجل (عشان نحسّن)</button> <button class="btn sec sm" id="ai_clr" style="margin-top:6px">🗑️ امسح السجل</button>' : '') +
      '</div>';
    document.body.appendChild(ov);
    function reopen() { ov.remove(); openAILab(); }
    document.getElementById('ai_x').onclick = function () { ov.remove(); };
    document.getElementById('ai_tg').onclick = async function () {
      if (aiOn()) localStorage.removeItem(AI_KEY);
      else {
        if (hasCloud && !cloudOk() && !(s && s.available)) { if (await askCloudConsent()) localStorage.setItem(CLOUD_OK, '1'); }
        localStorage.setItem(AI_KEY, '1');
      }
      tap(); reopen();
    };
    var cb = document.getElementById('ai_cloud');
    if (cb) cb.onclick = async function () {
      if (cloudOk()) localStorage.removeItem(CLOUD_OK);
      else if (await askCloudConsent()) localStorage.setItem(CLOUD_OK, '1');
      tap(); reopen();
    };
    var sh = document.getElementById('ai_share');
    if (sh) sh.onclick = function () { navigator.share({ title: 'سجل تجربة الذكاء — طلبيات', text: JSON.stringify(log, null, 1) }).catch(function () {}); };
    var cl = document.getElementById('ai_clr');
    if (cl) cl.onclick = function () { localStorage.removeItem(AI_LOG); reopen(); };
    document.getElementById('ai_go').onclick = async function () {
      var t = document.getElementById('ai_t').value.trim(), out = document.getElementById('ai_out');
      if (!t) return;
      out.innerHTML = '<div class="mut center" style="margin:10px">⏳ عم يفهم…</div>';
      try {
        var r = await aiParse(t), c = window.OrderParser.parse(t, r.products, r.rests);
        logAI({ t: Date.now(), text: t, engine: r.engine, ms: r.ms, ai: r.drafts, classic: c.drafts });
        out.innerHTML = '<div class="grid2" style="margin-top:10px;align-items:start">' +
          '<div class="card"><b>' + h(ENGINE_LABEL[r.engine] || '🧪 الذكاء') + '</b> <span class="mut">(' + (r.ms / 1000).toFixed(1) + ' ث)</span><div class="mut">اليوم: ' + dayTxt(r.date_offset) + '</div>' + draftsHtml(r.drafts, r.products, r.rests) + '</div>' +
          '<div class="card"><b>⚙️ العادي</b><div class="mut">اليوم: ' + dayTxt(c.date_offset) + '</div>' + draftsHtml(c.drafts, r.products, r.rests) + '</div></div>';
      } catch (err) {
        var code = errCode(err); logAI({ t: Date.now(), text: t, error: code });
        out.innerHTML = '<div class="card" style="margin-top:10px">❌ ' + h(AI_ERR[code] || 'الذكاء ما زبط') + ' <span class="mut" dir="ltr">(' + h(code) + ')</span></div>';
      }
    };
  }
  window.__openAILab = openAILab;

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
    // عرض لمرة وحدة تحت خانة الطلبية: «شغّل فهم الطلبيات بالذكاء؟»
    var ot = document.getElementById('otext');
    if (ot && hasCloud && !cloudOk() && !document.getElementById('np_aioffer') && localStorage.getItem('talabiyat_ai_offer') !== 'no') {
      var of = document.createElement('div'); of.id = 'np_aioffer'; of.className = 'sample'; of.style.marginTop = '10px';
      of.innerHTML = '<b>✨ جديد:</b> التطبيق صار يفهم الطلبيات الطويلة واللهجة أحسن بالذكاء.<div class="row" style="margin-top:8px"><button type="button" class="btn sm" id="np_aiyes">شغّله</button><button type="button" class="btn sec sm" id="np_aino">لا شكراً</button></div>';
      ot.parentNode.appendChild(of);
      document.getElementById('np_aiyes').onclick = async function () {
        if (await askCloudConsent()) { localStorage.setItem(CLOUD_OK, '1'); localStorage.setItem(AI_KEY, '1'); window.toast && toast('✨ الذكاء شغّال ✅'); }
        of.remove();
      };
      document.getElementById('np_aino').onclick = function () { localStorage.setItem('talabiyat_ai_offer', 'no'); of.remove(); };
    }
    if (h && anyAI() && !document.getElementById('np_ai')) {
      var a = document.createElement('button'); a.type = 'button'; a.id = 'np_ai'; a.className = 'btn block sec';
      a.textContent = '🧪 الذكاء (تجريبي)' + (aiOn() ? ' — شغّال' : '');
      a.onclick = openAILab; h.parentNode.appendChild(a);
    }
  }
  // فقاعة كلام «أحمد»: بتطلع كم ثانية لما تتغيّر الرسالة، بعدين بتختفي (الشخصية بتضل، والضغط عليها بيفتح التفاصيل)
  // التنبيهات الحمرا بتضل ظاهرة.
  var bubLast = '', bubTimer = null, bubHidden = false;
  function foldBubble() {
    var bar = document.getElementById('avbar'); if (!bar) return;
    var bub = document.getElementById('av_bub'); if (!bub) return;
    var msg = bub.textContent || '', red = /\bred\b/.test(bar.className), open = !!document.getElementById('av_panel');
    if (msg !== bubLast || red || open) { bubLast = msg; bubHidden = false; clearTimeout(bubTimer); if (!red && !open) bubTimer = setTimeout(function () { bubHidden = true; foldBubble(); }, 6000); }
    bub.style.display = bubHidden && !red && !open ? 'none' : '';
  }
  window.addEventListener('DOMContentLoaded', function () {
    var avb = document.getElementById('avbar');
    if (avb) new MutationObserver(foldBubble).observe(avb, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(decorate).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    decorate();
  });
})();
