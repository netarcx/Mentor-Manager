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

# ─── Ensure bnep kernel module ──────────────────────────────────────
ensure_bnep() {
  if ! lsmod 2>/dev/null | grep -q '^bnep'; then
    modprobe bnep 2>/dev/null || true
  fi
}

# ─── Helpers ─────────────────────────────────────────────────────────
get_bt_powered() {
  bluetoothctl show 2>/dev/null | grep -q "Powered: yes" && echo "on" || echo "off"
}

get_paired_iphones() {
  bluetoothctl devices Paired 2>/dev/null | grep -i iphone || \
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

# Connect to NAP profile via D-Bus
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

# Interactive pairing using an embedded bluetoothctl session.
# iPhones need proper agent handling for the passkey confirmation flow.
do_pair() {
  ensure_bnep

  print_info "Enabling Bluetooth adapter..."
  bluetoothctl power on >/dev/null 2>&1 || true
  print_ok "Adapter is on"

  # Make Ubuntu discoverable so iPhone can also initiate pairing
  bluetoothctl discoverable on >/dev/null 2>&1 || true
  bluetoothctl pairable on >/dev/null 2>&1 || true

  echo ""
  draw_line
  echo ""
  printf "  ${WHITE}How do you want to pair?${RESET}\n"
  echo ""
  printf "  ${WHITE}1${RESET} ${DIM})${RESET} Pair from Ubuntu ${DIM}(scan for iPhone)${RESET}\n"
  printf "  ${WHITE}2${RESET} ${DIM})${RESET} Pair from iPhone ${DIM}(recommended for iOS)${RESET}\n"
  echo ""
  printf "  ${CYAN}>${RESET} "
  read -rsn1 pair_mode
  echo ""
  echo ""

  if [[ "$pair_mode" == "2" ]]; then
    _pair_from_iphone
  else
    _pair_from_ubuntu
  fi

  # Turn off discoverable after pairing
  bluetoothctl discoverable off >/dev/null 2>&1 || true
}

# iPhone-initiated pairing: Ubuntu stays discoverable and waits
_pair_from_iphone() {
  # Get the Ubuntu adapter name so user knows what to look for
  local adapter_name
  adapter_name=$(bluetoothctl show 2>/dev/null | grep "Name:" | sed 's/.*Name: //' || echo "this computer")

  echo ""
  print_info "Ubuntu is now discoverable as: ${WHITE}${adapter_name}${RESET}"
  echo ""
  print_warn "On your iPhone:"
  echo "    1. Go to Settings > Bluetooth"
  echo "    2. Look for \"$adapter_name\" under Other Devices"
  echo "    3. Tap it to pair"
  echo ""
  print_info "Waiting for iPhone to initiate pairing..."
  print_info "An interactive bluetoothctl session will open to handle the pairing."
  echo ""
  print_warn "When you see a passkey confirmation, type 'yes' and press Enter."
  echo ""
  printf "  ${DIM}Press any key to open bluetoothctl...${RESET}"
  read -rsn1
  echo ""
  echo ""

  draw_line
  printf "  ${YELLOW}>>> bluetoothctl interactive session <<<${RESET}\n"
  printf "  ${DIM}Type 'yes' when asked to confirm passkey, then 'quit' when done.${RESET}\n"
  draw_line
  echo ""

  # Run interactive bluetoothctl so user can handle the passkey prompt
  bluetoothctl || true

  echo ""
  draw_line

  # Trust the device after pairing
  local mac
  mac=$(get_iphone_mac)
  if [[ -n "$mac" ]]; then
    bluetoothctl trust "$mac" >/dev/null 2>&1 || true
    local name
    name=$(get_iphone_name "$mac")
    print_ok "Paired and trusted: $name ($mac)"
  else
    print_err "No iPhone found after pairing session."
    print_info "Make sure you completed the pairing on both devices."
    return 1
  fi
}

# Ubuntu-initiated pairing: scan, find iPhone, pair
_pair_from_ubuntu() {
  echo ""
  print_warn "Open iPhone Settings > Bluetooth NOW"
  print_info "Scanning for 30 seconds..."
  echo ""

  bluetoothctl --timeout 30 scan on >/dev/null 2>&1 &disown
  local scan_pid=$!

  for i in $(seq 30 -1 1); do
    printf "\r  ${DIM}Scanning... %2ds remaining${RESET}" "$i"
    sleep 1
  done
  printf "\r  ${DIM}%-40s${RESET}\n" "Scan complete."
  kill "$scan_pid" 2>/dev/null || true

  # Check for any iPhone (paired or newly discovered)
  local mac
  mac=$(bluetoothctl devices 2>/dev/null | grep -i iphone | head -1 | awk '{print $2}')
  if [[ -z "$mac" ]]; then
    print_err "No iPhone found during scan."
    return 1
  fi

  local name
  name=$(bluetoothctl devices 2>/dev/null | grep "$mac" | sed 's/^Device [^ ]* //')
  print_ok "Found: $name ($mac)"

  echo ""
  print_info "Starting interactive pairing session..."
  print_warn "When you see a passkey, CONFIRM on BOTH devices."
  echo ""
  printf "  ${DIM}Press any key to open bluetoothctl...${RESET}"
  read -rsn1
  echo ""
  echo ""

  draw_line
  printf "  ${YELLOW}>>> bluetoothctl interactive session <<<${RESET}\n"
  printf "  ${DIM}Commands to run inside:${RESET}\n"
  printf "  ${WHITE}  pair $mac${RESET}\n"
  printf "  ${DIM}  (confirm passkey with 'yes')${RESET}\n"
  printf "  ${WHITE}  trust $mac${RESET}\n"
  printf "  ${WHITE}  quit${RESET}\n"
  draw_line
  echo ""

  # Run interactive bluetoothctl
  bluetoothctl || true

  echo ""
  draw_line

  # Verify pairing succeeded
  local paired_mac
  paired_mac=$(get_iphone_mac)
  if [[ -n "$paired_mac" ]]; then
    bluetoothctl trust "$paired_mac" >/dev/null 2>&1 || true
    local pname
    pname=$(get_iphone_name "$paired_mac")
    print_ok "Paired and trusted: $pname ($paired_mac)"
  else
    print_err "Pairing may not have completed."
    print_info "Try option 2 (Pair from iPhone) instead."
    return 1
  fi
}

# Inner connect logic. Pass skip_repair=1 to suppress the re-pair prompt.
_do_connect_inner() {
  local skip_repair="${1:-0}"

  ensure_bnep

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

  # Wait for BT connection to settle
  print_info "Waiting for Bluetooth link to settle..."
  sleep 5

  # Verify the BT connection is actually up
  local bt_connected
  bt_connected=$(bluetoothctl info "$mac" 2>/dev/null | grep "Connected: yes" || true)
  if [[ -z "$bt_connected" ]]; then
    print_warn "Bluetooth not connected yet, retrying..."
    bluetoothctl connect "$mac" >/dev/null 2>&1 || true
    sleep 3
  fi

  # Try NAP connection up to 3 times (iPhone can be slow to expose NAP)
  local nap_attempt=0
  local bt_if=""
  while (( nap_attempt < 3 )); do
    (( nap_attempt++ )) || true
    print_info "Joining PAN network (attempt $nap_attempt/3)..."
    dbus_nap_connect "$mac"

    # Wait for bnep interface
    local retries=8
    while (( retries-- > 0 )); do
      bt_if=$(get_bnep_iface)
      if [[ -n "$bt_if" ]]; then break 2; fi
      sleep 1
    done

    if (( nap_attempt < 3 )); then
      print_warn "No interface yet, retrying in 3s..."
      # Re-poke the BT connection before retrying NAP
      bluetoothctl connect "$mac" >/dev/null 2>&1 || true
      sleep 3
    fi
  done

  if [[ -z "$bt_if" ]]; then
    print_err "No bnep interface appeared after 3 attempts."

    if [[ "$skip_repair" == "1" ]]; then
      echo ""
      print_warn "Connection failed after fresh pairing."
      print_info "Make sure Personal Hotspot is ON and iPhone is unlocked."
      return 1
    fi

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
      do_pair || return 1
      echo ""
      print_info "Now attempting to connect with fresh pairing..."
      sleep 2
      _do_connect_inner 1
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

do_connect() {
  _do_connect_inner 0
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
ensure_bnep

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
