#!/bin/bash
# ============================================================================
# iphone-autopair.sh — Auto-pair and tether an iPhone on boot / hotplug
# ============================================================================
# Installed to /usr/local/bin/iphone-autopair.sh by setup or fix-usb-tether.
# Runs as a systemd service (iphone-autopair.service).
#
# Loop:
#   1. Wait for an Apple device on USB bus
#   2. Ensure usbmuxd is running
#   3. Wait for idevice_id to see the device (usbmuxd handshake)
#   4. Auto-pair (non-interactive — works if phone was trusted before)
#   5. Wait for the ipheth network interface to appear
#   6. Tell NetworkManager to bring it up
#   7. Sleep and re-check (handles unplug/replug)
# ============================================================================

set -uo pipefail

LOG_TAG="iphone-autopair"

log() {
  echo "[$LOG_TAG] $*"
  logger -t "$LOG_TAG" "$*" 2>/dev/null || true
}

POLL_INTERVAL="${POLL_INTERVAL:-5}"

log "Started (polling every ${POLL_INTERVAL}s)"

while true; do
  # --- Step 1: Is an Apple device on the USB bus? ---
  if ! grep -rql "05ac" /sys/bus/usb/devices/*/idVendor 2>/dev/null; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  # --- Step 2: Ensure usbmuxd is running ---
  if ! pgrep -x usbmuxd &>/dev/null; then
    log "Apple device detected, starting usbmuxd..."
    systemctl start usbmuxd 2>/dev/null || usbmuxd -f &
    sleep 2
  fi

  # --- Step 3: Wait for idevice_id to see the device ---
  if ! command -v idevice_id &>/dev/null; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  DEVICE_ID=$(idevice_id -l 2>/dev/null | head -1 || true)
  if [ -z "$DEVICE_ID" ]; then
    # usbmuxd might need a moment after hotplug
    sleep 3
    DEVICE_ID=$(idevice_id -l 2>/dev/null | head -1 || true)
  fi

  if [ -z "$DEVICE_ID" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  # --- Step 4: Auto-pair ---
  if command -v idevicepair &>/dev/null; then
    # Check if already paired
    if ! idevicepair validate 2>/dev/null; then
      log "Pairing with iPhone $DEVICE_ID..."
      if idevicepair pair 2>/dev/null; then
        log "Paired successfully"
      else
        log "Pairing failed — phone may need to be unlocked and Trust tapped"
        sleep "$POLL_INTERVAL"
        continue
      fi
    fi
  fi

  # --- Step 5: Wait for the network interface to appear ---
  # ipheth creates an interface when Personal Hotspot is on
  IFACE=""
  for attempt in 1 2 3 4 5; do
    for path in /sys/class/net/eth* /sys/class/net/usb* /sys/class/net/enx*; do
      [ -e "$path" ] || continue
      DEVPATH=$(readlink -f "$path/device" 2>/dev/null || echo "")
      DRIVER=$(basename "$(readlink -f "$path/device/driver" 2>/dev/null || echo "")" 2>/dev/null || true)
      if echo "$DEVPATH" | grep -q "usb" || [ "$DRIVER" = "ipheth" ]; then
        IFACE=$(basename "$path")
        break 2
      fi
    done
    sleep 2
  done

  if [ -z "$IFACE" ]; then
    log "iPhone paired but no tether interface — is Personal Hotspot enabled?"
    sleep "$POLL_INTERVAL"
    continue
  fi

  # --- Step 6: Tell NetworkManager to bring it up ---
  CURRENT_STATE=$(nmcli -t -f GENERAL.STATE dev show "$IFACE" 2>/dev/null | cut -d: -f2 || true)
  if echo "$CURRENT_STATE" | grep -qi "connected"; then
    # Already connected — just keep monitoring
    sleep "$POLL_INTERVAL"
    continue
  fi

  log "Bringing up $IFACE..."
  nmcli dev set "$IFACE" managed yes 2>/dev/null || true
  if nmcli dev connect "$IFACE" 2>/dev/null; then
    IP=$(ip -4 addr show "$IFACE" 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "pending")
    log "Connected on $IFACE (IP: $IP)"
  else
    log "Failed to connect $IFACE — retrying next cycle"
  fi

  sleep "$POLL_INTERVAL"
done
