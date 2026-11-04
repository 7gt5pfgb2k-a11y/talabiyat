# سيرفر الذكاء لـ «طلبيات» (Cloudflare Worker)

سيرفر وسيط صغير بين تطبيق iPhone و Claude. مفتاح Claude محفوظ هون وما بيطلع للتطبيق.

- النموذج: `claude-haiku-5-5`، الأرخص. لما بدك ترقّي، غيّر سطر `MODEL` بـ `src/index.js`.
- التكلفة المتوقعة: أقل من دولار بالشهر لاستعمال عادي (عشرات الطلبيات باليوم).
- Cloudflare Workers مجاني لحد 100 ألف طلب باليوم.
- ما بيخزّن أي شي. حد أقصى 20 طلب بالدقيقة، وكل طلب لازم يحمل مفتاح التطبيق `X-App-Token`.

## النشر (مرة وحدة، حوالي 15 دقيقة)

1. **مفتاح Claude:**
   - اعمل حساب على https://console.anthropic.com واشحن رصيد صغير (5$ بيكفّوا لفترة طويلة).
   - من **Settings ← Limits** حط **حد صرف شهري** (مثلاً 5$)، عشان ما ينصرف أكتر من هيك أبداً.
   - من **API Keys** اعمل مفتاح جديد وانسخه.
2. **حساب Cloudflare:** نفس الحساب اللي فيه سيرفر موقع سند بيمشي.
3. على أي كمبيوتر فيه Node:
   ```bash
   cd ai-worker
   npm install
   npx wrangler login                        # بيفتح المتصفح لتسجيل الدخول
   npx wrangler secret put ANTHROPIC_API_KEY # الصق مفتاح Claude
   npx wrangler secret put APP_TOKEN         # الصق كلمة سر طويلة عشوائية (شوف تحت)
   npx wrangler deploy                       # بيطبعلك الرابط: https://talabiyat-ai.<اسمك>.workers.dev
   ```
   لتعمل كلمة سر عشوائية: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
4. **جرّبه:** افتح `https://talabiyat-ai.<اسمك>.workers.dev/health`، لازم يطلع `{"ok":true,...}`.
5. **اربطه بالتطبيق:** ابعت الرابط وكلمة السر `APP_TOKEN` لـ Claude Code. أو عدّلهم بنفسك بـ `ios-app/native.js`:
   ```js
   var CLOUD = { url: 'https://talabiyat-ai.<اسمك>.workers.dev', token: '<APP_TOKEN>' };
   ```
   سكربت البناء بيسمح تلقائياً بهالعنوان بإعدادات الأمان (CSP) تبع التطبيق.

## ملاحظات أمان
- `APP_TOKEN` موجود جوا التطبيق، فحدا شاطر ممكن يطلّعه. الحماية الحقيقية هي **حد الصرف الشهري** بحساب Anthropic، وحد الـ 20 طلب بالدقيقة. لو شكّيت إنه انسرق، غيّره بـ `wrangler secret put APP_TOKEN` وحدّث التطبيق.
- الطلب بيحمل نص الطلبية وأسماء الأصناف والزبائن وأرقامهم بس. بدون تلفونات ولا عناوين ولا مبالغ.

## تجربة محلية (للمطورين)
ملف `.dev.vars` (مستثنى من git):
```
APP_TOKEN=test-token
ANTHROPIC_API_KEY=sk-ant-...
# اختياري للتجربة على سيرفر وهمي / متصفح محلي:
# ANTHROPIC_BASE_URL=http://127.0.0.1:9999
# DEV_ORIGIN=http://localhost:8123
```
بعدين `npx wrangler dev`.
