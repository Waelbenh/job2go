#!/bin/bash
# job2go - starts everything with one word, then opens your app in the browser.
#
#   1. serve.py   (your jobs, the buttons, the AI)  -> http://127.0.0.1:8765  (the old page stays there)
#   2. the website (web/, the new app)              -> http://localhost:5173/app
#
# Ctrl+C stops both. If one is already running (e.g. in another Terminal), it is used as it is,
# not started twice - and Ctrl+C here leaves it running.

cd "$(dirname "$0")/.." || exit 1   # the job-agent folder

# (the ports can be changed for testing; normally 8765 and 5173)
SERVE_PORT=${J2G_SERVE_PORT:-8765}
WEB_PORT=${J2G_WEB_PORT:-5173}
running() { lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
SERVE_PID=""
WEB_PID=""

stop() {
  echo ""
  echo "Stopping Job2go ..."
  [ -n "$WEB_PID" ] && pkill -P "$WEB_PID" 2>/dev/null; [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "$SERVE_PID" ] && kill "$SERVE_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Stopped."
  exit 0
}
trap stop INT TERM

if running $SERVE_PORT; then
  echo "serve.py is already running - using it."
else
  echo "Starting serve.py ..."
  .venv/bin/python serve.py --no-browser &
  SERVE_PID=$!
fi

if running $WEB_PORT; then
  echo "The website is already running - using it."
else
  echo "Starting the website ..."
  (cd web && exec npm run dev -- --port $WEB_PORT --strictPort) &
  WEB_PID=$!
fi

# Wait until both answer (at most 60 seconds)
for _ in $(seq 1 60); do
  if running $SERVE_PORT && running $WEB_PORT; then break; fi
  sleep 1
done
if ! running $SERVE_PORT || ! running $WEB_PORT; then
  echo "Something did not start. Read the messages above."
  stop
fi

echo ""
echo "Job2go is ready: http://localhost:$WEB_PORT/app   (press Ctrl+C to stop)"
[ -z "$J2G_NO_OPEN" ] && open "http://localhost:$WEB_PORT/app"

# Keep running until Ctrl+C (or until both stop by themselves)
if [ -n "$SERVE_PID$WEB_PID" ]; then
  wait
else
  echo "(Both were already running, so there is nothing to stop here.)"
fi
