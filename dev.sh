#!/bin/zsh
# Lance backend + frontend + vérifie la santé. Usage: ./dev.sh
dir=$(dirname "$0")

(cd "$dir/backend" && ./node_modules/.bin/tsx src/index.ts > "$dir/logs/backend.log" 2>&1 &)
(cd "$dir/frontend" && ./node_modules/.bin/next dev > "$dir/logs/frontend.log" 2>&1 &)

sleep 5
echo "Backend  : $(curl -s --max-time 3 http://localhost:4100/api/health || echo 'KO')"
echo "Frontend : $(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:3000 || echo 'KO')"
echo "Logs     : logs/backend.log · logs/frontend.log"
