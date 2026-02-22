#!/usr/bin/env bash
# iphone-bt-tether.sh — Connect Ubuntu to iPhone Bluetooth tethering
# Usage: sudo ./iphone-bt-tether.sh [pair|connect|disconnect|status]
set -euo pipefail

# ─── Dependency check ───────────────────────────────────────────────
check_deps() {
  local missing=()
  for cmd in bluetoothctl bt-network dhclient ip; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done
  if (( ${#missing[@]} )); then
    echo "Missing: ${missing[*]}"
    echo "Install with: sudo apt install bluez bluez-tools isc-dhcp-client iproute2"
    exit 1
  fi
}

# ─── Find iPhone MAC ────────────────────────────────────────────────
find_iphone() {
  local mac
  mac=$(bluetoothctl devices | grep -i iphone | head -1 | awk '{print $2}')
  if [[ -z "$mac" ]]; then
    echo "No paired iPhone found. Run: $0 pair"
    exit 1
  fi
  echo "$mac"
}

# ─── Pair ───────────────────────────────────────────────────────────
do_pair() {
  echo "==> Enabling Bluetooth adapter..."
  bluetoothctl power on
  bluetoothctl agent on
  bluetoothctl default-agent

  echo ""
  echo "==> Scanning for iPhones (30s)..."
  echo "    Make sure iPhone Settings > Bluetooth is open."
  echo ""
  bluetoothctl --timeout 30 scan on 2>/dev/null &
  local scan_pid=$!
  sleep 30
  kill "$scan_pid" 2>/dev/null || true

  local mac
  mac=$(bluetoothctl devices | grep -i iphone | head -1 | awk '{print $2}')
  if [[ -z "$mac" ]]; then
    echo "No iPhone found during scan."
    exit 1
  fi

  local name
  name=$(bluetoothctl devices | grep -i iphone | head -1 | sed 's/^Device [^ ]* //')
  echo "==> Found: $name ($mac)"
  echo "==> Pairing... Accept the prompt on BOTH devices."
  bluetoothctl pair "$mac"
  bluetoothctl trust "$mac"
  echo "==> Paired and trusted."
}

# ─── Connect ────────────────────────────────────────────────────────
do_connect() {
  local mac
  mac=$(find_iphone)
  local name
  name=$(bluetoothctl devices | grep "$mac" | sed 's/^Device [^ ]* //')
  echo "==> Connecting to $name ($mac)..."

  echo "    Make sure Personal Hotspot is ON in iPhone settings."
  echo ""

  # Connect Bluetooth profile
  bluetoothctl connect "$mac" || true
  sleep 2

  # Create PAN network connection via NAP profile
  echo "==> Joining PAN network (NAP)..."
  local iface
  iface=$(bt-network -c "$mac" nap 2>&1) || true

  # Wait for the bnep interface to appear
  local retries=10
  local bt_if=""
  while (( retries-- > 0 )); do
    bt_if=$(ip -o link show | grep -o 'bnep[0-9]*' | head -1) || true
    if [[ -n "$bt_if" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "$bt_if" ]]; then
    echo "ERROR: No bnep interface appeared. Make sure:"
    echo "  1. iPhone Personal Hotspot is ON"
    echo "  2. iPhone is unlocked and on the hotspot screen"
    exit 1
  fi

  echo "==> Interface $bt_if is up. Requesting IP via DHCP..."
  ip link set "$bt_if" up
  dhclient -v "$bt_if" 2>&1 | grep -E 'DHCPACK|bound to'

  local ip_addr
  ip_addr=$(ip -4 addr show "$bt_if" | grep -oP 'inet \K[\d.]+')
  echo ""
  echo "==> Connected!"
  echo "    Interface: $bt_if"
  echo "    IP:        ${ip_addr:-unknown}"
}

# ─── Disconnect ─────────────────────────────────────────────────────
do_disconnect() {
  local bt_if
  bt_if=$(ip -o link show | grep -o 'bnep[0-9]*' | head -1) || true

  if [[ -n "$bt_if" ]]; then
    echo "==> Releasing DHCP on $bt_if..."
    dhclient -r "$bt_if" 2>/dev/null || true
    ip link set "$bt_if" down 2>/dev/null || true
  fi

  local mac
  mac=$(bluetoothctl devices | grep -i iphone | head -1 | awk '{print $2}')
  if [[ -n "$mac" ]]; then
    echo "==> Disconnecting Bluetooth from $mac..."
    bt-network -d "$mac" 2>/dev/null || true
    bluetoothctl disconnect "$mac" 2>/dev/null || true
  fi

  echo "==> Disconnected."
}

# ─── Status ─────────────────────────────────────────────────────────
do_status() {
  echo "==> Bluetooth adapter:"
  bluetoothctl show | grep -E 'Name|Powered|Address' | sed 's/^/    /'

  echo ""
  echo "==> Paired iPhones:"
  local devices
  devices=$(bluetoothctl devices | grep -i iphone)
  if [[ -z "$devices" ]]; then
    echo "    (none)"
  else
    echo "$devices" | sed 's/^/    /'
  fi

  echo ""
  echo "==> PAN interfaces:"
  local bt_if
  bt_if=$(ip -o link show | grep 'bnep' || true)
  if [[ -z "$bt_if" ]]; then
    echo "    (none)"
  else
    echo "$bt_if" | sed 's/^/    /'
    ip -4 addr show | grep -A2 'bnep' | sed 's/^/    /'
  fi
}

# ─── Main ───────────────────────────────────────────────────────────
check_deps

case "${1:-connect}" in
  pair)       do_pair ;;
  connect)    do_connect ;;
  disconnect) do_disconnect ;;
  status)     do_status ;;
  *)
    echo "Usage: sudo $0 [pair|connect|disconnect|status]"
    echo ""
    echo "  pair        Scan and pair with an iPhone"
    echo "  connect     Connect to paired iPhone tethering (default)"
    echo "  disconnect  Drop the tethering connection"
    echo "  status      Show Bluetooth and PAN status"
    exit 1
    ;;
esac
