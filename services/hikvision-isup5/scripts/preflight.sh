#!/usr/bin/env bash
# Read-only AttendEase ISUP 5.0 Oracle VM preflight.
# Does not install packages, edit configuration, start/stop services,
# bind ports or change UFW/Oracle Cloud rules.

set -u
set -o pipefail

printf '\n=== Operating system ===\n'
if [ -r /etc/os-release ]; then
  . /etc/os-release
  printf 'OS: %s\n' "$PRETTY_NAME"
fi
printf 'Kernel: '
uname -srmo
printf 'Architecture: '
uname -m

printf '\n=== CPU ===\n'
if command -v nproc >/dev/null 2>&1; then
  printf 'Logical CPUs: '
  nproc
fi
awk -F: '/^model name/ {gsub(/^[ \t]+/, "", $2); print "CPU model: " $2; exit}' /proc/cpuinfo 2>/dev/null || true

printf '\n=== Memory ===\n'
free -h 2>/dev/null || awk '/MemTotal|MemAvailable|SwapTotal|SwapFree/ {print}' /proc/meminfo

printf '\n=== Disk ===\n'
df -h / /opt 2>/dev/null || df -h /

printf '\n=== Relevant TCP listeners (read-only) ===\n'
if command -v ss >/dev/null 2>&1; then
  ss -lnt 2>/dev/null | awk '
    NR == 1 ||
    /:80[[:space:]]/ ||
    /:443[[:space:]]/ ||
    /:3000[[:space:]]/ ||
    /:3100[[:space:]]/ ||
    /:7660[[:space:]]/ ||
    /:7661[[:space:]]/ ||
    /:7662[[:space:]]/ ||
    /:7999[[:space:]]/ ||
    /:8000[[:space:]]/'
else
  printf 'ss command unavailable.\n'
fi

printf '\n=== UFW status (read-only) ===\n'
if command -v ufw >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ]; then
    ufw status numbered
  elif command -v sudo >/dev/null 2>&1; then
    sudo ufw status numbered
  else
    printf 'UFW is installed but sudo is unavailable to this account.\n'
  fi
else
  printf 'UFW is not installed.\n'
fi

printf '\n=== Existing services (read-only) ===\n'
if command -v systemctl >/dev/null 2>&1; then
  for unit in attendease-hikvision-receiver caddy; do
    printf '%s: ' "$unit"
    systemctl is-active "$unit" 2>/dev/null || true
  done
else
  printf 'systemctl unavailable.\n'
fi

printf '\n=== Potential vendor directories (names only) ===\n'
for path in /opt/hikvision /opt/hikvision-isup /opt/hik-device-gateway /usr/local/hikvision; do
  if [ -e "$path" ]; then
    printf 'Exists: %s\n' "$path"
  fi
done

printf '\nPreflight complete. No settings were changed.\n'
printf 'Do not select ISUP ports until the official Gateway/SDK assigns them and current VM port owners are confirmed.\n'
