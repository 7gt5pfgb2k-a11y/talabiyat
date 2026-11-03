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
