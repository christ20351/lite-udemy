#!/bin/bash
# Watchdog : relance le backend (4100) et le frontend (3000) s'ils meurent.
BACKEND_DIR=/home/geohot/lite-udemy/backend
FRONTEND_DIR=/home/geohot/lite-udemy/frontend

while true; do
  if ! curl -s --max-time 2 http://localhost:4100/api/health > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] backend down → relance" >> /tmp/watchdog.log
    cd "$BACKEND_DIR" && setsid nohup ./node_modules/.bin/tsx src/index.ts >> /tmp/backend-dev.log 2>&1 < /dev/null &
  fi
  if ! curl -s --max-time 4 -o /dev/null http://localhost:3000 2>&1; then
    echo "[$(date +%H:%M:%S)] frontend down → relance" >> /tmp/watchdog.log
    cd "$FRONTEND_DIR" && setsid nohup ./node_modules/.bin/next dev >> /tmp/next-dev.log 2>&1 < /dev/null &
  fi
  sleep 8
done
