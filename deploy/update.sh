#!/bin/bash
# VPS update skripti — har gal ssh root@138.249.7.110 keyin bajaring:
#   bash /root/record_nazorat/deploy/update.sh
set -e

cd /root/record_nazorat

echo "==> 1/5: git pull"
git pull origin main

echo "==> 2/5: server paketlar"
cd server
npm install --omit=dev
cd ..

echo "==> 3/5: client paketlar + build"
cd client
npm install
npm run build
cd ..

echo "==> 4/5: pm2 restart"
pm2 restart recordnazorat-api

echo "==> 5/5: log oxirgi 20 qator"
sleep 2
pm2 logs recordnazorat-api --lines 20 --nostream

echo ""
echo "✅ Deploy yakunlandi: https://recordspeaking.uz"
