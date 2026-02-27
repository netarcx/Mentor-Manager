#!/bin/bash
# ============================================================================
# fix-usb-tether.sh — Fix USB tethering on a kiosk Pi / Orange Pi
# ============================================================================
#
# Run on the Pi:  sudo bash fix-usb-tether.sh
#
# What this does:
#   1. Installs iPhone tethering packages (usbmuxd, libimobiledevice)
#   2. Loads kernel modules for USB tethering (RNDIS, CDC-ECM, CDC-NCM,
#      ipheth for iPhone)
#   3. Persists them so they load on every boot
#   4. Creates NetworkManager connections that auto-connect USB tether
#      interfaces (usb0, enx*, iPhone eth)
#   5. Adds a udev rule so NM immediately manages hotplugged USB adapters
#   6. Detects a currently-plugged phone and brings it online
#
# Supports: Android (RNDIS/ECM/NCM) and iPhone (ipheth via libimobiledevice)
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
# 1. Install iPhone tethering packages
# --------------------------------------------------------------------------
echo "[1/6] Installing iPhone tethering support..."
apt-get update -qq
apt-get install -y -qq \
  usbmuxd \
  libimobiledevice6 \
  libimobiledevice-utils \
  > /dev/null 2>&1 && echo "  Installed: usbmuxd, libimobiledevice" \
  || echo "  Warning: could not install iPhone packages (may already be present)"

# usbmuxd must be running for iPhone USB communication
systemctl enable usbmuxd 2>/dev/null || true
systemctl start usbmuxd 2>/dev/null || true
echo "  usbmuxd service: $(systemctl is-active usbmuxd 2>/dev/null || echo 'not running')"

# --------------------------------------------------------------------------
# 2. Load kernel modules
#    Android: rndis_host, cdc_ether, cdc_ncm
#    iPhone:  ipheth (iPhone USB ethernet, paired with usbmuxd)
# --------------------------------------------------------------------------
echo "[2/6] Loading USB tethering kernel modules..."
MODULES=(rndis_host cdc_ether cdc_ncm ipheth)

for mod in "${MODULES[@]}"; do
  if modprobe "$mod" 2>/dev/null; then
    echo "  Loaded: $mod"
  else
    echo "  Skipped: $mod (not available on this kernel)"
  fi
done

# --------------------------------------------------------------------------
# 3. Persist modules across reboots
# --------------------------------------------------------------------------
echo "[3/6] Persisting modules in /etc/modules..."
for mod in "${MODULES[@]}"; do
  if ! grep -qx "$mod" /etc/modules 2>/dev/null; then
    echo "$mod" >> /etc/modules
    echo "  Added: $mod"
  else
    echo "  Already present: $mod"
  fi
done

# --------------------------------------------------------------------------
# 4. Create NetworkManager connections for USB tethering
# --------------------------------------------------------------------------
echo "[4/6] Configuring NetworkManager for USB tethering..."

# Remove stale profiles if they exist (idempotent re-run)
nmcli con delete "USB Tether" 2>/dev/null && echo "  Removed old profile" || true
nmcli con delete "USB Tether Alt" 2>/dev/null || true
nmcli con delete "iPhone Tether" 2>/dev/null || true

# Android: matches usb0, usb1, etc. (classic naming)
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

# Predictable names (enx...) — covers some Android and iPhone setups
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

# iPhone: ipheth creates eth1 (or eth2, etc.) — use a wildcard keyfile
# NM doesn't support eth* wildcards in nmcli, so write the profile directly
cat > /etc/NetworkManager/conf.d/20-iphone-tether.conf << 'NMCONF'
# Auto-manage iPhone tethering interface (ipheth driver)
[device-iphone]
match-device=driver:ipheth
managed=1
NMCONF
echo "  Created NM config: iPhone ipheth auto-managed"

# --------------------------------------------------------------------------
# 5. Udev rules — tell NM to manage hotplugged USB network devices
# --------------------------------------------------------------------------
echo "[5/6] Adding udev rules for USB network devices..."

UDEV_RULE="/etc/udev/rules.d/90-usb-tether.rules"
cat > "$UDEV_RULE" << 'UDEV'
# Auto-manage USB tethering interfaces with NetworkManager
# Android: RNDIS, CDC-ECM, CDC-NCM
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="rndis_host", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ether", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ncm", ENV{NM_UNMANAGED}="0"
# iPhone: ipheth
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="ipheth", ENV{NM_UNMANAGED}="0"
# Trigger NM to pick up iPhone tether when usbmuxd pairs the device
ACTION=="add", SUBSYSTEM=="net", ATTRS{idVendor}=="05ac", ENV{NM_UNMANAGED}="0"
UDEV
echo "  Wrote $UDEV_RULE"

udevadm control --reload-rules
udevadm trigger --subsystem-match=net
echo "  Reloaded udev rules"

# --------------------------------------------------------------------------
# 6. Detect & connect any currently-plugged phone
# --------------------------------------------------------------------------
echo "[6/6] Scanning for active USB network interfaces..."

# Restart services to pick up all changes
systemctl restart NetworkManager
systemctl restart usbmuxd 2>/dev/null || true
sleep 2

echo ""
nmcli device status 2>/dev/null || true
echo ""

# Check for an iPhone specifically
if lsusb 2>/dev/null | grep -qi "apple"; then
  echo "  iPhone detected on USB!"
  # Verify pairing — iPhone needs to be trusted ("Trust This Computer")
  if command -v idevicepair &>/dev/null; then
    echo "  Checking iPhone pairing..."
    if idevicepair validate 2>/dev/null; then
      echo "  iPhone is paired and trusted"
    else
      echo "  >>> Unlock your iPhone and tap 'Trust This Computer' <<<"
      echo "  Then re-run this script or run: idevicepair pair"
    fi
  fi
fi

# Try to bring up any disconnected tether interface
FOUND=false
for iface in /sys/class/net/usb* /sys/class/net/enx* /sys/class/net/eth*; do
  [ -e "$iface" ] || continue
  NAME=$(basename "$iface")
  # Skip the main ethernet port
  [ "$NAME" = "eth0" ] && continue
  # Check if this is a USB device (not built-in ethernet)
  DEVPATH=$(readlink -f "$iface/device" 2>/dev/null || echo "")
  if echo "$DEVPATH" | grep -q "usb"; then
    echo "  Found USB interface: $NAME"
    nmcli dev set "$NAME" managed yes 2>/dev/null || true
    nmcli dev connect "$NAME" 2>/dev/null && echo "  Connected: $NAME" || echo "  Waiting for phone tethering to be enabled"
    FOUND=true
  fi
done

if [ "$FOUND" = false ]; then
  echo "  No USB tethering interface detected."
  echo ""
  echo "  For iPhone:"
  echo "    1. Plug in via USB cable"
  echo "    2. Unlock and tap 'Trust This Computer' if prompted"
  echo "    3. Enable Personal Hotspot in Settings"
  echo "    4. Re-run this script or wait a moment for auto-connect"
  echo ""
  echo "  For Android:"
  echo "    1. Plug in via USB cable"
  echo "    2. Enable USB tethering in Settings"
fi

echo ""
echo "=== Done ==="
echo ""
echo "USB tethering should now work automatically for iPhone and Android."
echo ""
echo "  Check status:  nmcli device status"
echo "  See IP:         ip addr"
echo "  iPhone paired:  idevicepair validate"
