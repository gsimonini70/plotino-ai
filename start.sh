#!/usr/bin/env bash
# Plotino — avvio bridge pubblicazione + server statico per l’interfaccia web.
#
# Uso:
#   ./start.sh
# Opzioni ambiente:
#   HTTP_PORT=5500       porta interfaccia (default 5500)
#   BRIDGE_PORT=8787     porta bridge (default 8787)
#   SKIP_BRIDGE=1        avvia solo il server HTTP
#   OPEN_BROWSER=0       non aprire il browser (default: apre)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTTP_PORT="${HTTP_PORT:-5500}"
BRIDGE_PORT="${BRIDGE_PORT:-8787}"
SKIP_BRIDGE="${SKIP_BRIDGE:-0}"
OPEN_BROWSER="${OPEN_BROWSER:-1}"

# Variabili per il bridge (endpoint social): copia plotino.env.example → plotino.env
ENV_FILE="${ROOT}/plotino.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  echo "[plotino] Caricate variabili da plotino.env"
fi

BRIDGE_PID=""

cleanup() {
  if [[ -n "${BRIDGE_PID}" ]] && kill -0 "${BRIDGE_PID}" 2>/dev/null; then
    kill "${BRIDGE_PID}" 2>/dev/null || true
    wait "${BRIDGE_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "${SKIP_BRIDGE}" != "1" ]]; then
  export BIND_HOST="${BIND_HOST:-127.0.0.1}"
  export BIND_PORT="${BRIDGE_PORT}"
  python3 "${ROOT}/bridge/publish_server.py" &
  BRIDGE_PID=$!
  echo "[plotino] Bridge pubblicazione → http://${BIND_HOST}:${BRIDGE_PORT} (POST /publish)"
else
  echo "[plotino] Bridge disattivato (SKIP_BRIDGE=1)"
fi

echo "[plotino] Interfaccia web    → http://127.0.0.1:${HTTP_PORT}"
echo "[plotino] Ctrl+C per fermare tutto."
echo ""

if [[ "${OPEN_BROWSER}" == "1" ]] && command -v open >/dev/null 2>&1; then
  (sleep 0.4 && open "http://127.0.0.1:${HTTP_PORT}/") &
fi

cd "${ROOT}"
python3 -m http.server "${HTTP_PORT}" --bind 127.0.0.1
