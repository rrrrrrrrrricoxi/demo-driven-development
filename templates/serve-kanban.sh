#!/usr/bin/env bash
# 看板起停(由 init 种入项目)。no-cache 静态服 serve.py,绑 0.0.0.0 走 tailscale。
# 单进程无重载器,kill_port 兜底即可。
#
# 验主拒杀(设计 §4):杀端口前先核实占用者属本看板 —— 该 pid 的 cwd 或 cmdline
# 必须含本看板目录;异主(别的项目/别人的进程占了同端口)→ 报错拒杀,绝不误杀邻居。
# 同机多项目端口需人工分配(init 探测只避得开当下占用,避不开"写了没起"的,见设计 §5)。
set -euo pipefail

# 看板目录 = 本脚本旁的 serve.py 所在处;单独种到别处时用 KANBAN_DIR 覆盖。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KANBAN_DIR="${KANBAN_DIR:-$SCRIPT_DIR}"
if [ ! -f "$KANBAN_DIR/serve.py" ]; then
  echo "找不到 $KANBAN_DIR/serve.py —— 设 KANBAN_DIR 指向 app/kanban" >&2; exit 1
fi

# 端口读 config(缺省 8898)
CONFIG="$KANBAN_DIR/kanban.config.json"
PORT="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("port",8898))' "$CONFIG" 2>/dev/null || echo 8898)"

PY="${KANBAN_PY:-python3}"
LOG="${KANBAN_LOG:-$KANBAN_DIR/kanban.log}"

# 验主 + 杀端口:只杀 cwd/cmdline 含本看板目录的占用者;异主报错拒杀。
kill_port_owned() {
  local port="$1" pids pid cwd cmd
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  for pid in $pids; do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    if printf '%s\n%s\n' "$cwd" "$cmd" | grep -qF "$KANBAN_DIR"; then
      kill "$pid" 2>/dev/null || true
    else
      echo "端口 $port 被异主进程 $pid 占用(cwd=$cwd cmd=$cmd),拒杀。" >&2
      echo "非本看板目录($KANBAN_DIR)的进程,请人工核实后处理。" >&2
      exit 1
    fi
  done
  sleep 1
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $port 仍被占用,启动中止(lsof -i:$port 查看)。" >&2; exit 1
  fi
}

# 先按路径收自己人(best-effort),再验主杀端口兜底。
pkill -f -- "$KANBAN_DIR/serve.py" 2>/dev/null || true
kill_port_owned "$PORT"

cd "$KANBAN_DIR"
nohup "$PY" serve.py "$PORT" > "$LOG" 2>&1 &
echo "kanban pid $! → http://0.0.0.0:$PORT/  (log: $LOG)"

# 验活:本机回环,--noproxy 避开代理把"没起好"伪装成 502;--retry 容忍慢启动。
curl -s --noproxy '*' --retry 15 --retry-connrefused --retry-delay 1 \
  -o /dev/null -w "kanban %{http_code}\n" "http://127.0.0.1:$PORT/" || true
