# سيرفر الذكاء لـ «طلبيات» (Cloudflare Worker)

سيرفر وسيط صغير بين تطبيق iPhone والذكاء. المفاتيح محفوظة هون وما بتطلع للتطبيق.

| المزوّد | متى بيشتغل | التكلفة | البيانات |
|---|---|---|---|
| **Google Gemini** (`gemini-3.5-flash-lite`) | إذا في سر `GEMINI_API_KEY` | ببلاش (الباقة المجانية) | Google ممكن تستعملها لتحسين منتجاتها |
| **Claude** (`claude-haiku-5-5`) | إذا في `ANTHROPIC_API_KEY` بس، أو `PROVIDER=claude` | أقل من دولار بالشهر | ما بتنستعمل للتدريب |

للتبديل بين المزوّدين: ضيف السر المناسب، أو حط متغير `PROVIDER` بقيمة `gemini` أو `claude`. التطبيق بيعرف المزوّد لحاله من `/health`، وشاشة الموافقة بتسمّيه.
ولما تبدّل المزوّد، حدّث سياسة الخصوصية (`privacy.html`).

بالباقتين: ما في تخزين، وفي حد أقصى 20 طلب بالدقيقة، وكل طلب لازم يحمل `X-App-Token`.

## النشر (مرة وحدة)
1. **مفتاح Gemini (مجاني):** من https://aistudio.google.com/apikey اكبس **Create API key** وانسخه.
2. **Cloudflare:** نفس حساب سيرفر سند.
3. على أي كمبيوتر فيه Node:
   ```bash
   cd ai-worker
   npm install
   npx wrangler login
   npx wrangler deploy                     # بيطبعلك الرابط: https://talabiyat-ai.<اسمك>.workers.dev
   npx wrangler secret put GEMINI_API_KEY  # الصق مفتاح Gemini
   npx wrangler secret put APP_TOKEN       # الصق كلمة سر عشوائية طويلة (شوف تحت)
   ```
   لتعمل كلمة سر عشوائية: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
4. **جرّبه:** افتح `…/health`، لازم يطلع `{"ok":true,"provider":"gemini",...}`.
5. **اربطه بالتطبيق:** حط الرابط وكلمة السر بـ `ios-app/native.js`:
   ```js
   var CLOUD = { url: 'https://talabiyat-ai.<اسمك>.workers.dev', token: '<APP_TOKEN>' };
   ```

## ملاحظات
- `APP_TOKEN` جوا التطبيق، فممكن حدا يطلّعه. مع Gemini المجاني ما في فاتورة أصلاً. ومع Claude، حط **حد صرف شهري** بحساب Anthropic.
- بالباقة المجانية في حد يومي من Google. إذا خلص، التطبيق بيرجع للفهم العادي لحاله.

## تجربة محلية
`.dev.vars` (مستثنى من git): `APP_TOKEN=...` و `GEMINI_API_KEY=...` أو `ANTHROPIC_API_KEY=...`.
للتجربة على سيرفر وهمي فيك تضيف `GEMINI_BASE_URL` / `ANTHROPIC_BASE_URL` و `DEV_ORIGIN`. بعدين `npx wrangler dev`.
