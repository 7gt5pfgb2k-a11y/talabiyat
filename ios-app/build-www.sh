#!/bin/bash
# يبني www/ من ملفات الـPWA اللي بجذر الريبو (بدون ما يعدّلها)
set -euo pipefail
cd "$(dirname "$0")"
SRC=..
rm -rf www && mkdir www
cp -r $SRC/{index.html,app.css,store.js,common.js,parser.js,manager.js,avatar.js,help.js,manifest.webmanifest,favicon.png,privacy.html,icons,fonts,vendor} www/
cp native.js www/native.js
cp native.css www/native.css
sed -i.bak 's#<link rel="stylesheet" href="app.css">#<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="native.css">#' www/index.html && rm -f www/index.html.bak
grep -q 'native.css' www/index.html
# بدون service worker داخل التطبيق (الملفات أصلاً داخل الحزمة)
sed -i.bak "s/if ('serviceWorker' in navigator) {/if ('serviceWorker' in navigator \&\& !window.__NATIVE_APP) {/" www/common.js && rm -f www/common.js.bak
grep -q "__NATIVE_APP" www/common.js
# native.js أول سكربت
sed -i.bak 's#<script src="store.js"></script>#<script src="native.js"></script><script src="store.js"></script>#' www/index.html && rm -f www/index.html.bak
grep -q 'native.js' www/index.html
# توافق مع iOS 15 (WebKit 15)
for f in store common parser manager avatar help native; do
  npx esbuild www/$f.js --target=safari15 --charset=utf8 --log-level=warning --outfile=www/$f.tmp.js && mv www/$f.tmp.js www/$f.js
done
echo "www ready: $(du -sh www | cut -f1)"
