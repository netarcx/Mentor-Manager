#!/usr/bin/env bash
# iphone-bt-tether.sh — Connect Ubuntu to iPhone Bluetooth tethering
# Usage: sudo ./iphone-bt-tether.sh          (interactive TUI)
#        sudo ./iphone-bt-tether.sh [command] (non-interactive)
set -euo pipefail

# ─── Colors & Drawing ───────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BG_BLUE='\033[44m'
BG_RESET='\033[49m'

COLS=$(tput cols 2>/dev/null || echo 60)
BOX_W=$(( COLS > 60 ? 58 : COLS - 2 ))

draw_line() {
  printf "${DIM}"
  printf '%.0s─' $(seq 1 "$BOX_W")
  printf "${RESET}\n"
}

draw_header() {
  clear
  echo ""
  printf "  ${WHITE}${BG_BLUE} %-$(( BOX_W - 2 ))s ${BG_RESET}${RESET}\n" "iPhone Bluetooth Tethering"
  echo ""
}

print_status_line() {
  local label="$1" value="$2" color="${3:-$WHITE}"
  printf "  ${DIM}%-18s${RESET} ${color}%s${RESET}\n" "$label" "$value"
}

print_ok()    { printf "  ${GREEN}[OK]${RESET} %s\n" "$1"; }
print_err()   { printf "  ${RED}[!!]${RESET} %s\n" "$1"; }
print_info()  { printf "  ${CYAN}[..]${RESET} %s\n" "$1"; }
print_warn()  { printf "  ${YELLOW}[!!]${RESET} %s\n" "$1"; }

pause() {
  echo ""
  printf "  ${DIM}Press any key to continue...${RESET}"
  read -rsn1
}

# ─── Dependency check ───────────────────────────────────────────────
check_deps() {
  local missing=()
  for cmd in bluetoothctl dbus-send dhclient ip; do
    command -v "$cmd" &>/dev/null || missing+=("$cmd")
  done
  if (( ${#missing[@]} )); then
    print_err "Missing commands: ${missing[*]}"
    echo ""
    print_info "Install with:"
    echo "    sudo apt install bluez dbus isc-dhcp-client iproute2"
    echo ""
    exit 1
  fi
}

# ─── Helpers ─────────────────────────────────────────────────────────
get_bt_powered() {
  bluetoothctl show 2>/dev/null | grep -q "Powered: yes" && echo "on" || echo "off"
}

get_paired_iphones() {
  bluetoothctl devices 2>/dev/null | grep -i iphone || true
}

get_iphone_mac() {
  get_paired_iphones | head -1 | awk '{print $2}'
}

get_iphone_name() {
  local mac="$1"
  bluetoothctl devices 2>/dev/null | grep "$mac" | sed 's/^Device [^ ]* //'
}

mac_to_dbus_path() {
  # Convert AA:BB:CC:DD:EE:FF -> /org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF
  local mac="$1"
  echo "/org/bluez/hci0/dev_${mac//:/_}"
}

get_bnep_iface() {
  ip -o link show 2>/dev/null | grep -o 'bnep[0-9]*' | head -1 || true
}

get_bnep_ip() {
  local iface="$1"
  ip -4 addr show "$iface" 2>/dev/null | grep -oP 'inet \K[\d.]+' || true
}

is_connected() {
  [[ -n "$(get_bnep_iface)" ]]
}

# Connect to NAP profile via D-Bus (replaces bt-network which segfaults)
dbus_nap_connect() {
  local mac="$1"
  local dev_path
  dev_path=$(mac_to_dbus_path "$mac")

  dbus-send --system --type=method_call --dest=org.bluez \
    "$dev_path" org.bluez.Network1.Connect \
    string:"nap" 2>&1 || true
}

# Disconnect NAP profile via D-Bus
dbus_nap_disconnect() {
  local mac="$1"
  local dev_path
  dev_path=$(mac_to_dbus_path "$mac")

  dbus-send --system --type=method_call --dest=org.bluez \
    "$dev_path" org.bluez.Network1.Disconnect 2>&1 || true
}

# ─── Status Display ─────────────────────────────────────────────────
show_status() {
  local powered
  powered=$(get_bt_powered)

  local paired_line
  paired_line=$(get_paired_iphones | head -1)
  local paired_name="(none)"
  local paired_mac=""
  if [[ -n "$paired_line" ]]; then
    paired_mac=$(echo "$paired_line" | awk '{print $2}')
    paired_name=$(echo "$paired_line" | sed 's/^Device [^ ]* //')
  fi

  local bt_if
  bt_if=$(get_bnep_iface)
  local conn_status="Disconnected"
  local conn_color="$RED"
  local ip_addr=""
  if [[ -n "$bt_if" ]]; then
    ip_addr=$(get_bnep_ip "$bt_if")
    if [[ -n "$ip_addr" ]]; then
      conn_status="Connected"
      conn_color="$GREEN"
    else
      conn_status="Interface up, no IP"
      conn_color="$YELLOW"
    fi
  fi

  draw_line
  if [[ "$powered" == "on" ]]; then
    print_status_line "Bluetooth:" "ON" "$GREEN"
  else
    print_status_line "Bluetooth:" "OFF" "$RED"
  fi
  print_status_line "Paired iPhone:" "$paired_name" "$WHITE"
  if [[ -n "$paired_mac" ]]; then
    print_status_line "" "$paired_mac" "$DIM"
  fi
  print_status_line "Connection:" "$conn_status" "$conn_color"
  if [[ -n "$ip_addr" ]]; then
    print_status_line "IP Address:" "$ip_addr" "$CYAN"
    print_status_line "Interface:" "$bt_if" "$DIM"
  fi
  draw_line
}

# ─── Actions ─────────────────────────────────────────────────────────
do_pair() {
  print_info "Enabling Bluetooth adapter..."
  bluetoothctl power on >/dev/null 2>&1 || true
  bluetoothctl agent on >/dev/null 2>&1 || true
  bluetoothctl default-agent >/dev/null 2>&1 || true
  print_ok "Adapter is on"

  echo ""
  print_warn "Open iPhone Settings > Bluetooth NOW"
  print_info "Scanning for 30 seconds..."
  echo ""

  bluetoothctl --timeout 30 scan on >/dev/null 2>&1 &disown
  local scan_pid=$!

  # Show a progress indicator
  for i in $(seq 30 -1 1); do
    printf "\r  ${DIM}Scanning... %2ds remaining${RESET}" "$i"
    sleep 1
  done
  printf "\r  ${DIM}%-40s${RESET}\n" "Scan complete."
  kill "$scan_pid" 2>/dev/null || true

  local mac
  mac=$(get_iphone_mac)
  if [[ -z "$mac" ]]; then
    print_err "No iPhone found during scan."
    return 1
  fi

  local name
  name=$(get_iphone_name "$mac")
  print_ok "Found: $name ($mac)"

  echo ""
  print_info "Pairing... Accept the prompt on BOTH devices."
  bluetoothctl pair "$mac" 2>&1 | sed 's/^/    /' || true
  bluetoothctl trust "$mac" >/dev/null 2>&1 || true
  print_ok "Paired and trusted!"
}

do_connect() {
  local mac
  mac=$(get_iphone_mac)
  if [[ -z "$mac" ]]; then
    print_err "No paired iPhone found. Pair first."
    return 1
  fi

  local name
  name=$(get_iphone_name "$mac")
  print_info "Connecting to $name..."

  bluetoothctl power on >/dev/null 2>&1 || true
  bluetoothctl connect "$mac" >/dev/null 2>&1 || true
  sleep 2

  print_info "Joining PAN network..."
  dbus_nap_connect "$mac"

  # Wait for bnep interface
  local retries=10
  local bt_if=""
  while (( retries-- > 0 )); do
    bt_if=$(get_bnep_iface)
    if [[ -n "$bt_if" ]]; then break; fi
    sleep 1
  done

  if [[ -z "$bt_if" ]]; then
    print_err "No bnep interface appeared."
    echo ""
    print_warn "This usually means the pairing is stale."
    print_info "The iPhone may be asking you to forget this device."
    echo ""
    printf "  ${YELLOW}Forget and re-pair automatically? [Y/n]:${RESET} "
    read -rn1 repair_choice
    echo ""
    if [[ ! "$repair_choice" =~ ^[Nn]$ ]]; then
      print_info "Removing stale pairing..."
      dbus_nap_disconnect "$mac"
      bluetoothctl disconnect "$mac" >/dev/null 2>&1 || true
      bluetoothctl remove "$mac" >/dev/null 2>&1 || true
      echo ""
      print_warn "On your iPhone: Settings > Bluetooth > forget this device too"
      print_info "Then press any key when ready to re-pair..."
      read -rsn1
      echo ""
      do_pair
      if [[ $? -eq 0 ]]; then
        echo ""
        print_info "Now attempting to connect with fresh pairing..."
        do_connect
      fi
      return $?
    fi
    echo ""
    print_warn "To fix manually:"
    echo "    1. On iPhone: Settings > Bluetooth > forget this device"
    echo "    2. Re-run pair from the menu"
    return 1
  fi

  print_info "Requesting IP via DHCP on $bt_if..."
  ip link set "$bt_if" up 2>/dev/null
  dhclient "$bt_if" >/dev/null 2>&1 || true

  local ip_addr
  ip_addr=$(get_bnep_ip "$bt_if")
  if [[ -n "$ip_addr" ]]; then
    print_ok "Connected! IP: $ip_addr"
  else
    print_warn "Interface up but no IP assigned. DHCP may have failed."
  fi
}

do_disconnect() {
  local bt_if
  bt_if=$(get_bnep_iface)

  if [[ -n "$bt_if" ]]; then
    print_info "Releasing DHCP on $bt_if..."
    dhclient -r "$bt_if" >/dev/null 2>&1 || true
    ip link set "$bt_if" down 2>/dev/null || true
  fi

  local mac
  mac=$(get_iphone_mac)
  if [[ -n "$mac" ]]; then
    print_info "Disconnecting Bluetooth..."
    dbus_nap_disconnect "$mac"
    bluetoothctl disconnect "$mac" >/dev/null 2>&1 || true
  fi

  print_ok "Disconnected."
}

do_forget() {
  local mac
  mac=$(get_iphone_mac)
  if [[ -z "$mac" ]]; then
    print_warn "No paired iPhone to forget."
    return 0
  fi

  local name
  name=$(get_iphone_name "$mac")

  printf "  ${YELLOW}Remove ${WHITE}${name}${YELLOW} ($mac)? [y/N]:${RESET} "
  read -rn1 confirm
  echo ""
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    do_disconnect 2>/dev/null
    bluetoothctl remove "$mac" >/dev/null 2>&1 || true
    print_ok "Removed $name"
  else
    print_info "Cancelled."
  fi
}

# ─── Interactive TUI ─────────────────────────────────────────────────
run_tui() {
  while true; do
    draw_header
    show_status
    echo ""

    # Build menu based on current state
    local has_paired=false
    local connected=false
    [[ -n "$(get_iphone_mac)" ]] && has_paired=true
    is_connected && connected=true

    if $connected; then
      printf "  ${WHITE}1${RESET} ${DIM})${RESET} Disconnect\n"
      printf "  ${WHITE}2${RESET} ${DIM})${RESET} Reconnect\n"
      printf "  ${WHITE}3${RESET} ${DIM})${RESET} Forget iPhone\n"
      printf "  ${WHITE}4${RESET} ${DIM})${RESET} Refresh status\n"
      printf "  ${WHITE}q${RESET} ${DIM})${RESET} Quit\n"
    elif $has_paired; then
      printf "  ${WHITE}1${RESET} ${DIM})${RESET} Connect\n"
      printf "  ${WHITE}2${RESET} ${DIM})${RESET} Re-pair iPhone\n"
      printf "  ${WHITE}3${RESET} ${DIM})${RESET} Forget iPhone\n"
      printf "  ${WHITE}4${RESET} ${DIM})${RESET} Refresh status\n"
      printf "  ${WHITE}q${RESET} ${DIM})${RESET} Quit\n"
    else
      printf "  ${WHITE}1${RESET} ${DIM})${RESET} Scan & Pair iPhone\n"
      printf "  ${WHITE}4${RESET} ${DIM})${RESET} Refresh status\n"
      printf "  ${WHITE}q${RESET} ${DIM})${RESET} Quit\n"
    fi

    echo ""
    printf "  ${CYAN}>${RESET} "
    read -rsn1 choice
    echo ""
    echo ""

    if $connected; then
      case "$choice" in
        1) do_disconnect; pause ;;
        2) do_disconnect 2>/dev/null; do_connect; pause ;;
        3) do_forget; pause ;;
        4) ;; # just refresh
        q|Q) echo ""; exit 0 ;;
        *) ;;
      esac
    elif $has_paired; then
      case "$choice" in
        1) do_connect; pause ;;
        2) do_pair; pause ;;
        3) do_forget; pause ;;
        4) ;; # just refresh
        q|Q) echo ""; exit 0 ;;
        *) ;;
      esac
    else
      case "$choice" in
        1) do_pair; pause ;;
        4) ;; # just refresh
        q|Q) echo ""; exit 0 ;;
        *) ;;
      esac
    fi
  done
}

# ─── Main ───────────────────────────────────────────────────────────
check_deps

case "${1:-}" in
  pair)       do_pair ;;
  connect)    do_connect ;;
  disconnect) do_disconnect ;;
  status)     draw_header; show_status; echo "" ;;
  help|--help|-h)
    echo "Usage: sudo $0 [command]"
    echo ""
    echo "  (no args)    Interactive TUI"
    echo "  pair         Scan and pair with an iPhone"
    echo "  connect      Connect to paired iPhone tethering"
    echo "  disconnect   Drop the tethering connection"
    echo "  status       Show current status"
    echo "  help         Show this message"
    ;;
  "") run_tui ;;
  *)
    echo "Unknown command: $1 (try: help)"
    exit 1
    ;;
esac
