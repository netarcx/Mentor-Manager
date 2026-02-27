#!/bin/bash
# ============================================================================
# fix-usb-tether.sh — Fix USB tethering on a kiosk Pi / Orange Pi
# ============================================================================
#
# Run on the Pi:  sudo bash fix-usb-tether.sh
#
# What this does:
#   1. Loads kernel modules for USB tethering (RNDIS, CDC-ECM, CDC-NCM)
#   2. Persists them so they load on every boot
#   3. Creates a NetworkManager connection that auto-connects any USB
#      network interface (usb0, usb1, enx*)
#   4. Adds a udev rule so NM immediately manages hotplugged USB adapters
#   5. Detects a currently-plugged phone and brings it online
#
# After running this, just plug in your phone and turn on USB tethering.
# ============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash fix-usb-tether.sh"
  exit 1
fi

echo "=== USB Tethering Fix ==="
echo ""

# --------------------------------------------------------------------------
# 1. Load kernel modules (covers Android RNDIS, iPhone/Android ECM, NCM)
# --------------------------------------------------------------------------
echo "[1/5] Loading USB tethering kernel modules..."
MODULES=(rndis_host cdc_ether cdc_ncm)

for mod in "${MODULES[@]}"; do
  if modprobe "$mod" 2>/dev/null; then
    echo "  Loaded: $mod"
  else
    echo "  Skipped: $mod (not available on this kernel)"
  fi
done

# --------------------------------------------------------------------------
# 2. Persist modules across reboots
# --------------------------------------------------------------------------
echo "[2/5] Persisting modules in /etc/modules..."
for mod in "${MODULES[@]}"; do
  if ! grep -qx "$mod" /etc/modules 2>/dev/null; then
    echo "$mod" >> /etc/modules
    echo "  Added: $mod"
  else
    echo "  Already present: $mod"
  fi
done

# --------------------------------------------------------------------------
# 3. Create a NetworkManager connection for USB tethering
# --------------------------------------------------------------------------
echo "[3/5] Configuring NetworkManager for USB tethering..."

# Remove stale profiles if they exist (idempotent re-run)
nmcli con delete "USB Tether" 2>/dev/null && echo "  Removed old profile" || true

# Wildcard connection: matches usb0, usb1, etc. (classic naming)
nmcli con add \
  type ethernet \
  con-name "USB Tether" \
  ifname usb0 \
  ipv4.method auto \
  ipv6.method auto \
  connection.autoconnect yes \
  connection.autoconnect-priority 50 \
  > /dev/null 2>&1
echo "  Created profile: USB Tether (usb0)"

# Some kernels use predictable names (enx...) — add a second profile
nmcli con delete "USB Tether Alt" 2>/dev/null || true
nmcli con add \
  type ethernet \
  con-name "USB Tether Alt" \
  ifname "enx*" \
  ipv4.method auto \
  ipv6.method auto \
  connection.autoconnect yes \
  connection.autoconnect-priority 50 \
  > /dev/null 2>&1 || true
echo "  Created profile: USB Tether Alt (enx*)"

# --------------------------------------------------------------------------
# 4. Udev rule — tell NM to manage hotplugged USB network devices
# --------------------------------------------------------------------------
echo "[4/5] Adding udev rule for USB network devices..."

UDEV_RULE="/etc/udev/rules.d/90-usb-tether.rules"
cat > "$UDEV_RULE" << 'UDEV'
# Auto-manage USB tethering interfaces with NetworkManager
# Matches Android RNDIS, iPhone NCM/ECM, and generic USB ethernet
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="rndis_host|cdc_ether|cdc_ncm", ENV{NM_UNMANAGED}="0"
UDEV
echo "  Wrote $UDEV_RULE"

udevadm control --reload-rules
udevadm trigger --subsystem-match=net
echo "  Reloaded udev rules"

# --------------------------------------------------------------------------
# 5. Detect & connect any currently-plugged USB tether
# --------------------------------------------------------------------------
echo "[5/5] Scanning for active USB network interfaces..."

nmcli device status 2>/dev/null || true

# Try to bring up any disconnected USB interface
FOUND=false
for iface in /sys/class/net/usb* /sys/class/net/enx*; do
  [ -e "$iface" ] || continue
  NAME=$(basename "$iface")
  echo "  Found: $NAME"
  # Kick NM to pick it up
  nmcli dev set "$NAME" managed yes 2>/dev/null || true
  nmcli dev connect "$NAME" 2>/dev/null && echo "  Connected: $NAME" || echo "  Waiting for phone tethering to be enabled"
  FOUND=true
done

if [ "$FOUND" = false ]; then
  echo "  No USB tethering interface detected."
  echo "  Plug in your phone and enable USB tethering — it will auto-connect."
fi

# Restart NM to pick up all changes
systemctl restart NetworkManager

echo ""
echo "=== Done ==="
echo ""
echo "USB tethering should now work automatically."
echo "Just plug in your phone and enable USB tethering."
echo ""
echo "To check status:  nmcli device status"
echo "To see IP:        ip addr show usb0"
