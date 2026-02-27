#!/bin/bash
# ============================================================================
# fix-usb-tether.sh — Fix USB tethering on a kiosk Pi / Orange Pi
# ============================================================================
#
# Run on the Pi:  sudo bash fix-usb-tether.sh
#
# Supports: Raspberry Pi OS, Armbian, Orange Pi OS (Debian/Ubuntu based)
# Phones:   Android (RNDIS/ECM/NCM) and iPhone (ipheth + usbmuxd)
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
# 0. System info (diagnostics)
# --------------------------------------------------------------------------
echo "[0] System info"
echo "  Board:   $(cat /proc/device-tree/model 2>/dev/null || echo 'unknown')"
echo "  Distro:  $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo 'unknown')"
echo "  Kernel:  $(uname -r)"
echo "  Arch:    $(uname -m)"
echo ""

# Detect distro family for package manager differences
DISTRO_ID=$(. /etc/os-release 2>/dev/null && echo "${ID:-unknown}" || echo "unknown")
DISTRO_LIKE=$(. /etc/os-release 2>/dev/null && echo "${ID_LIKE:-}" || echo "")

# --------------------------------------------------------------------------
# 1. Install iPhone tethering packages
# --------------------------------------------------------------------------
echo "[1/6] Installing iPhone tethering support..."
apt-get update -qq 2>&1 | tail -3

# The key packages:
#   usbmuxd             — USB multiplexing daemon for iPhone communication
#   libimobiledevice-utils — CLI tools (idevice_id, idevicepair, etc.)
# On some distros the shared lib is a separate package; on others it's a dep.
PKGS_TO_INSTALL="usbmuxd libimobiledevice-utils"

# Check what's available in the repos
echo "  Checking available packages..."
AVAILABLE=""
for pkg in usbmuxd libimobiledevice-utils libimobiledevice6 libimobiledevice-1.0-6; do
  if apt-cache show "$pkg" &>/dev/null; then
    AVAILABLE="$AVAILABLE $pkg"
  fi
done
echo "  Available in repos:$AVAILABLE"

if [ -z "$AVAILABLE" ]; then
  echo ""
  echo "  WARNING: No iPhone tethering packages found in repos."
  echo "  Your sources.list may be missing standard Debian/Ubuntu repos."
  echo ""
  echo "  Checking sources..."
  grep -rh "^deb " /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null | head -5
  echo ""
  echo "  You may need to add the universe (Ubuntu) or main (Debian) repo."
  echo "  Continuing with Android-only tethering support..."
  echo ""
  SKIP_IPHONE=true
else
  SKIP_IPHONE=false
  echo "  Installing:$AVAILABLE"
  # shellcheck disable=SC2086
  apt-get install -y $AVAILABLE 2>&1 | tail -10
fi

# Verify the binaries actually exist
echo ""
echo "  Checking installed binaries:"
MISSING_BINS=false
for cmd in usbmuxd idevice_id idevicepair; do
  BIN=$(command -v "$cmd" 2>/dev/null || true)
  if [ -n "$BIN" ]; then
    echo "    $cmd -> $BIN"
  else
    # Search paths that might not be in root's $PATH
    for dir in /usr/bin /usr/sbin /usr/local/bin /sbin /usr/lib/usbmuxd; do
      if [ -x "$dir/$cmd" ]; then
        BIN="$dir/$cmd"
        echo "    $cmd -> $BIN (not in PATH — symlinking)"
        ln -sf "$BIN" /usr/local/bin/"$cmd"
        break
      fi
    done
    if [ -z "$BIN" ]; then
      echo "    $cmd -> NOT FOUND"
      MISSING_BINS=true
    fi
  fi
done

# Show package status
echo ""
dpkg -l usbmuxd libimobiledevice-utils 2>/dev/null | grep -E "^(ii|rc|un)" || echo "  (packages not in dpkg database)"
echo ""

# Start usbmuxd
if [ "$SKIP_IPHONE" = false ]; then
  systemctl enable usbmuxd 2>/dev/null || true
  systemctl restart usbmuxd 2>/dev/null || true
  USBMUXD_STATUS=$(systemctl is-active usbmuxd 2>/dev/null || echo "not running")
  echo "  usbmuxd service: $USBMUXD_STATUS"

  # If systemd can't start it, try directly
  if [ "$USBMUXD_STATUS" != "active" ]; then
    USBMUXD_BIN=$(command -v usbmuxd 2>/dev/null || true)
    if [ -n "$USBMUXD_BIN" ]; then
      echo "  Trying to start usbmuxd directly..."
      killall usbmuxd 2>/dev/null || true
      "$USBMUXD_BIN" -f -v &
      disown
      sleep 2
      if pgrep -x usbmuxd &>/dev/null; then
        echo "  usbmuxd running (PID $(pgrep -x usbmuxd))"
      else
        echo "  usbmuxd failed to start"
      fi
    fi
  fi
fi

# --------------------------------------------------------------------------
# 2. Load kernel modules
# --------------------------------------------------------------------------
echo ""
echo "[2/6] Loading USB tethering kernel modules..."
MODULES=(rndis_host cdc_ether cdc_ncm ipheth)

for mod in "${MODULES[@]}"; do
  if modprobe "$mod" 2>/dev/null; then
    echo "  Loaded: $mod"
  else
    echo "  Skipped: $mod (not in this kernel)"
    # Check if the module exists but couldn't be loaded
    if find /lib/modules/"$(uname -r)" -name "${mod}.ko*" 2>/dev/null | grep -q .; then
      echo "    Module file exists but failed to load — check: dmesg | tail"
    fi
  fi
done

# Check kernel config for ipheth support
KCONFIG="/boot/config-$(uname -r)"
if [ -f "$KCONFIG" ]; then
  IPHETH_CFG=$(grep -i "CONFIG_USB_IPHETH" "$KCONFIG" 2>/dev/null || echo "not set")
  echo "  Kernel ipheth config: $IPHETH_CFG"
  if echo "$IPHETH_CFG" | grep -q "not set"; then
    echo "  WARNING: This kernel was NOT built with iPhone USB tethering (ipheth)."
    echo "  iPhone tethering will NOT work until the kernel is rebuilt or updated."
    echo "  Android USB tethering should still work."
  fi
elif [ -f /proc/config.gz ]; then
  IPHETH_CFG=$(zcat /proc/config.gz 2>/dev/null | grep -i "CONFIG_USB_IPHETH" || echo "not set")
  echo "  Kernel ipheth config: $IPHETH_CFG"
  if echo "$IPHETH_CFG" | grep -q "not set"; then
    echo "  WARNING: This kernel was NOT built with iPhone USB tethering (ipheth)."
    echo "  iPhone tethering will NOT work until the kernel is rebuilt or updated."
  fi
else
  echo "  Kernel config not found — cannot verify ipheth support"
fi

# --------------------------------------------------------------------------
# 3. Persist modules across reboots
# --------------------------------------------------------------------------
echo ""
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
echo ""
echo "[4/6] Configuring NetworkManager for USB tethering..."

# Remove stale profiles (idempotent re-run)
for name in "USB Tether" "USB Tether Alt" "iPhone Tether"; do
  nmcli con delete "$name" 2>/dev/null || true
done

# Android: usb0
nmcli con add type ethernet con-name "USB Tether" ifname usb0 \
  ipv4.method auto ipv6.method auto \
  connection.autoconnect yes connection.autoconnect-priority 50 \
  > /dev/null 2>&1 && echo "  Created: USB Tether (usb0)" || echo "  Warning: could not create usb0 profile"

# Predictable names (enx...)
nmcli con add type ethernet con-name "USB Tether Alt" ifname "enx*" \
  ipv4.method auto ipv6.method auto \
  connection.autoconnect yes connection.autoconnect-priority 50 \
  > /dev/null 2>&1 && echo "  Created: USB Tether Alt (enx*)" || echo "  Warning: could not create enx* profile"

# iPhone ipheth driver auto-managed by NM
mkdir -p /etc/NetworkManager/conf.d
cat > /etc/NetworkManager/conf.d/20-iphone-tether.conf << 'NMCONF'
[device-iphone]
match-device=driver:ipheth
managed=1
NMCONF
echo "  Created: NM config for ipheth auto-manage"

# --------------------------------------------------------------------------
# 5. Udev rules
# --------------------------------------------------------------------------
echo ""
echo "[5/6] Adding udev rules for USB network devices..."

cat > /etc/udev/rules.d/90-usb-tether.rules << 'UDEV'
# Android: RNDIS, CDC-ECM, CDC-NCM
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="rndis_host", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ether", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ncm", ENV{NM_UNMANAGED}="0"
# iPhone: ipheth
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="ipheth", ENV{NM_UNMANAGED}="0"
# Apple devices by vendor ID
ACTION=="add", SUBSYSTEM=="net", ATTRS{idVendor}=="05ac", ENV{NM_UNMANAGED}="0"
UDEV
echo "  Wrote /etc/udev/rules.d/90-usb-tether.rules"

udevadm control --reload-rules
udevadm trigger --subsystem-match=net
echo "  Reloaded udev rules"

# --------------------------------------------------------------------------
# 6. Install auto-pair service (runs on boot + hotplug)
# --------------------------------------------------------------------------
echo ""
echo "[6/7] Installing iPhone auto-pair service..."

# Copy the auto-pair script
AUTOPAIR_SRC="$(dirname "$0")/iphone-autopair.sh"
AUTOPAIR_DST="/usr/local/bin/iphone-autopair.sh"

if [ -f "$AUTOPAIR_SRC" ]; then
  cp "$AUTOPAIR_SRC" "$AUTOPAIR_DST"
else
  # If run standalone without the repo, download or create inline
  echo "  iphone-autopair.sh not found next to this script, skipping service install."
  echo "  Copy iphone-autopair.sh to the Pi and place it at $AUTOPAIR_DST"
  AUTOPAIR_DST=""
fi

if [ -n "$AUTOPAIR_DST" ]; then
  chmod +x "$AUTOPAIR_DST"

  cat > /etc/systemd/system/iphone-autopair.service << EOF
[Unit]
Description=iPhone USB auto-pair and tether
After=network.target usbmuxd.service
Wants=usbmuxd.service

[Service]
Type=simple
ExecStart=$AUTOPAIR_DST
Restart=always
RestartSec=5
Environment=POLL_INTERVAL=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable iphone-autopair.service
  systemctl restart iphone-autopair.service
  echo "  Installed and started: iphone-autopair.service"
  echo "  Service status: $(systemctl is-active iphone-autopair 2>/dev/null || echo 'not running')"
fi

# --------------------------------------------------------------------------
# 7. Detect & connect
# --------------------------------------------------------------------------
echo ""
echo "[7/7] Scanning for connected phones..."

systemctl restart NetworkManager
[ "$SKIP_IPHONE" = false ] && { systemctl restart usbmuxd 2>/dev/null || true; }
sleep 2

echo ""
echo "  Network devices:"
nmcli device status 2>/dev/null || true
echo ""

# Check for iPhone on USB bus
if grep -rql "05ac" /sys/bus/usb/devices/*/idVendor 2>/dev/null; then
  echo "  iPhone detected on USB bus!"

  if [ "$SKIP_IPHONE" = true ] || [ "$MISSING_BINS" = true ]; then
    echo "  But iPhone tools are not installed — only Android tethering will work."
    echo "  To fix: install usbmuxd and libimobiledevice-utils from a working repo."
  elif command -v idevice_id &>/dev/null; then
    DEVICE_ID=$(idevice_id -l 2>/dev/null || true)
    if [ -n "$DEVICE_ID" ]; then
      echo "  Device ID: $DEVICE_ID"
      echo "  Initiating pairing..."
      echo "  >>> Unlock your iPhone and tap 'Trust This Computer' if prompted <<<"
      idevicepair pair 2>&1 | while IFS= read -r line; do echo "  $line"; done
      sleep 3
      if idevicepair pair 2>/dev/null; then
        echo "  iPhone paired successfully"
      else
        echo "  Pairing incomplete — unlock iPhone, tap Trust, then run:"
        echo "    idevicepair pair"
      fi
    else
      echo "  iPhone on bus but usbmuxd can't see it."
      echo "  Restarting usbmuxd..."
      systemctl restart usbmuxd 2>/dev/null || killall usbmuxd 2>/dev/null; usbmuxd -f -v & disown
      sleep 3
      DEVICE_ID=$(idevice_id -l 2>/dev/null || true)
      if [ -n "$DEVICE_ID" ]; then
        echo "  Now visible: $DEVICE_ID"
        echo "  >>> Unlock iPhone and tap 'Trust This Computer' <<<"
        idevicepair pair 2>&1 | while IFS= read -r line; do echo "  $line"; done
      else
        echo "  Still not visible. Try:"
        echo "    1. Unplug and re-plug the iPhone"
        echo "    2. Unlock the phone"
        echo "    3. Re-run: sudo bash fix-usb-tether.sh"
      fi
    fi
  fi
fi

# Try to bring up any USB tether interface
FOUND=false
for iface in /sys/class/net/usb* /sys/class/net/enx* /sys/class/net/eth*; do
  [ -e "$iface" ] || continue
  NAME=$(basename "$iface")
  DEVPATH=$(readlink -f "$iface/device" 2>/dev/null || echo "")
  if echo "$DEVPATH" | grep -q "usb"; then
    echo "  Found USB interface: $NAME"
    nmcli dev set "$NAME" managed yes 2>/dev/null || true
    nmcli dev connect "$NAME" 2>/dev/null && echo "  Connected: $NAME" || echo "  Waiting for tethering to be enabled on phone"
    FOUND=true
  fi
done

if [ "$FOUND" = false ]; then
  echo "  No USB tethering interface detected."
  echo ""
  echo "  For iPhone:"
  echo "    1. Plug in via Lightning/USB-C cable"
  echo "    2. Unlock and tap 'Trust This Computer' if prompted"
  echo "    3. Enable Personal Hotspot in Settings > Personal Hotspot"
  echo "    4. Re-run this script or wait for auto-connect"
  echo ""
  echo "  For Android:"
  echo "    1. Plug in via USB cable"
  echo "    2. Enable USB tethering in Settings > Network > Hotspot"
fi

echo ""
echo "=== Done ==="
echo ""
echo "  The iphone-autopair service will now automatically pair and tether"
echo "  any previously-trusted iPhone on boot or hotplug."
echo ""
echo "  First time with a new iPhone: plug in, unlock, tap 'Trust This Computer'."
echo "  After that, tethering is fully automatic."
echo ""
echo "  Check status:      nmcli device status"
echo "  See IP:             ip addr"
echo "  iPhone device:      idevice_id -l"
echo "  iPhone pair:        idevicepair pair"
echo "  Auto-pair service:  systemctl status iphone-autopair"
echo "  Auto-pair logs:     journalctl -u iphone-autopair -f"
