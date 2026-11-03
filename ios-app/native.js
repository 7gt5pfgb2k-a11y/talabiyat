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
})();
