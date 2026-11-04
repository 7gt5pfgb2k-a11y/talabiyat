# طلبيات — نسخة iPhone (Capacitor)

- الفرع `ios-build` فقط. نسخة الويب على `main` و GitHub Pages ما بتتأثر.
- ملفات الويب بتنسخ من جذر المستودع لـ `www/` عبر `build-www.sh` (مع `native.js` و `native.css`).
- `native.js`: مشاركة/ملفات أصلية، إشعارات محلية، موقع أصلي، اهتزاز، رابط سياسة الخصوصية.
- Bundle ID: `app.talabiyat` — الاسم: طلبيات — iPhone فقط، عمودي، iOS 15+.

## البناء
- تلقائي: `ci/ios-build.yml` (Mac سحابي، بدون توقيع) — ينسخ لـ `.github/workflows/ios-build.yml` ليشتغل عند كل push على `ios-build`.
- للرفع على TestFlight: `ci/ios-testflight.yml` (معطّل، شوف التعليمات جواته) أو `codemagic.yaml` بجذر المستودع.

```
cd ios-app && npm ci && npm run sync   # بعدها افتح ios/App/App.xcodeproj على Mac
```

## 🧪 تجربة: الذكاء على الجهاز (Foundation Models)
- إضافة محلية بـ `plugins/talabiyat-ai/` (Swift): بتنادي نموذج Apple اللي على الجهاز (iOS 26+، أجهزة Apple Intelligence) لتحويل نص الطلبية لطلبية منظّمة. ما في إنترنت ولا سيرفر ولا تكلفة.
- مطفأة افتراضياً. بتنشغل من **المزيد ← 🧪 الذكاء على الجهاز**. نفس الشاشة بتعرض حالة الجهاز (مدعوم؟ العربي مدعوم؟) وبتقارن النموذج مع `parser.js` على نفس النص.
- لو النموذج مش متوفر أو فشل أو ما فهم: زر «التالي» بيرجع تلقائياً للفهم العادي (`parser.js`).
- سجل التجارب (آخر 30) محفوظ على الجهاز بس، وفي زر لمشاركته يدوياً.
- لاحقاً: نموذج Apple على Private Cloud Compute (مجاني ضمن Small Business Program) بنفس الواجهة.

### ☁️ الذكاء بالإنترنت (اختياري، بموافقة)
- لما المستخدم يوافق، فهم الطلبية بيصير بذكاء بالإنترنت (حالياً Google Gemini المجاني، أو Claude) عبر سيرفر وسيط (`ai-worker/`، Cloudflare Worker).
- الترتيب: الذكاء بالإنترنت إذا مسموح وفي إنترنت، بعدين Apple على الجهاز، وإلا `parser.js`.
- مخفي لحد ما ينعبّى `CLOUD.url` و `CLOUD.token` بـ `native.js`. شوف `ai-worker/README.md` للنشر.
- بعد النشر حدّث خانة الخصوصية بـ App Store Connect: **User Content → Other User Content**، لـ App Functionality، مش مربوطة بالهوية، بدون تتبع.
