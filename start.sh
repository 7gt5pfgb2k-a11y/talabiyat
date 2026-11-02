#!/bin/bash
# تشغيل/إعادة تشغيل طلبيات محلياً (على جهاز التطوير). في الإنتاج: npm start على Render.
cd "$(dirname "$0")"
for p in $(pgrep -f "server.js"); do [ "$(readlink /proc/$p/cwd)" = "$PWD" ] || [[ "$(tr '\0' ' ' < /proc/$p/cmdline)" == *"$PWD/server.js"* ]] && kill $p; done
sleep 1
nohup node server.js > server.log 2>&1 &
sleep 1.5; tail -2 server.log; echo "local: http://localhost:${PORT:-3030}"
