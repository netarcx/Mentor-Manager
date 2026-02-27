#!/bin/bash
# ============================================================================
# UV PitCrew — Raspberry Pi Kiosk Setup (TUI Installer)
# ============================================================================
#
# Turns a Raspberry Pi 3 into a dedicated kiosk that auto-boots into the
# UV PitCrew dashboard in fullscreen Chromium.
#
# Prerequisites:
#   1. Flash Raspberry Pi OS Lite (Bookworm, 32-bit) to an SD card
#   2. Enable SSH and configure Wi-Fi via Raspberry Pi Imager (or raspi-config)
#   3. Boot the Pi and SSH in
#   4. Copy this script to the Pi and run it:
#
#        sudo bash setup.sh
#
#   Or with a URL argument to skip the prompt:
#
#        sudo bash setup.sh https://your-server-address/dashboard
#
#   5. The Pi will reboot and launch the dashboard in fullscreen.
#
# To change the URL later:
#   Edit /home/kiosk/url.txt and reboot
#
# To exit kiosk mode on a connected keyboard:
#   Ctrl+Alt+F2  → switch to tty2, log in, and run commands
#   Ctrl+Alt+F1  → switch back to kiosk
#
# ============================================================================

set -euo pipefail

LOG="/tmp/kiosk-setup.log"
> "$LOG"

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash setup.sh"
  exit 1
fi

# --------------------------------------------------------------------------
# TUI helpers (whiptail is pre-installed on Raspberry Pi OS)
# --------------------------------------------------------------------------
W=70
H=16

msg() {
  whiptail --title "UV PitCrew Kiosk Setup" --msgbox "$1" "$H" "$W"
}

err() {
  whiptail --title "Error" --msgbox "$1" "$H" "$W"
}

yesno() {
  whiptail --title "UV PitCrew Kiosk Setup" --yesno "$1" "$H" "$W"
}

# --------------------------------------------------------------------------
# Welcome
# --------------------------------------------------------------------------
msg "Welcome to the UV PitCrew Kiosk installer!

This will configure your Raspberry Pi as a
dedicated fullscreen dashboard display.

What it does:
  * Creates a dedicated kiosk user
  * Installs X11, Openbox, and Chromium
  * Configures auto-login and auto-start
  * Disables screen blanking
  * Enables Bluetooth and USB tethering
  * Sets hostname to mentor-kiosk"

# --------------------------------------------------------------------------
# Dashboard URL (accept via CLI arg or prompt interactively)
# --------------------------------------------------------------------------
DASHBOARD_URL="${1:-}"

if [ -z "$DASHBOARD_URL" ]; then
  BASE_URL=$(whiptail --title "Server URL" \
    --inputbox "Enter the base URL of your server:" \
    10 "$W" "https://" \
    3>&1 1>&2 2>&3) || exit 1

  if [ -z "$BASE_URL" ]; then
    err "No URL provided. Aborting."
    exit 1
  fi

  # Strip trailing slash
  BASE_URL="${BASE_URL%/}"

  DASH_TYPE=$(whiptail --title "Dashboard Type" \
    --menu "Which dashboard should the kiosk display?" \
    12 "$W" 2 \
    "dashboard"   "Standard dashboard (mentoring sessions)" \
    "competition"  "Competition dashboard (live scores)" \
    3>&1 1>&2 2>&3) || exit 1

  DASHBOARD_URL="$BASE_URL/$DASH_TYPE"
fi

if [ -z "$DASHBOARD_URL" ]; then
  err "No URL provided. Aborting."
  exit 1
fi

# --------------------------------------------------------------------------
# Confirm before installing
# --------------------------------------------------------------------------
# Derive display label for the dashboard type
case "$DASHBOARD_URL" in
  */competition) DASH_LABEL="Competition" ;;
  *)             DASH_LABEL="Standard" ;;
esac

yesno "Ready to install with these settings:

  URL:       $DASHBOARD_URL
  Dashboard: $DASH_LABEL
  Hostname:  mentor-kiosk
  Auto-login: enabled
  Screen blanking: disabled
  Mouse cursor: visible

Continue?" || exit 0

# --------------------------------------------------------------------------
# Installation with progress gauge
# --------------------------------------------------------------------------
FAIL_FILE="/tmp/kiosk-setup-fail"
rm -f "$FAIL_FILE"

(
  # --- 1. Create kiosk user ------------------------------------------------
  echo "XXX"
  echo 5
  echo "Creating kiosk user..."
  echo "XXX"
  {
    if ! id -u kiosk &>/dev/null; then
      useradd -m -s /bin/bash kiosk
      usermod -aG video,audio,input,tty kiosk
    fi
    echo "$DASHBOARD_URL" > /home/kiosk/url.txt
    chown kiosk:kiosk /home/kiosk/url.txt
  } >> "$LOG" 2>&1 || { echo "Creating kiosk user" > "$FAIL_FILE"; exit 1; }

  # --- 2. Update package lists ---------------------------------------------
  echo "XXX"
  echo 15
  echo "Updating package lists..."
  echo "XXX"
  apt-get update -qq >> "$LOG" 2>&1 || { echo "Updating package lists" > "$FAIL_FILE"; exit 1; }

  # --- 3. Install packages -------------------------------------------------
  echo "XXX"
  echo 25
  echo "Installing packages (this takes a few minutes)..."
  echo "XXX"
  apt-get install -y -qq \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    openbox \
    chromium \
    xdotool \
    fonts-liberation \
    libgles2 \
    unclutter \
    network-manager \
    bluez \
    usbmuxd \
    libimobiledevice6 \
    libimobiledevice-utils \
    >> "$LOG" 2>&1 || { echo "Installing packages" > "$FAIL_FILE"; exit 1; }

  # --- 4. Enable NetworkManager and Bluetooth --------------------------------
  echo "XXX"
  echo 45
  echo "Enabling tethering support..."
  echo "XXX"
  {
    # Load USB tethering kernel modules (Android RNDIS/ECM/NCM, iPhone ipheth)
    for mod in rndis_host cdc_ether cdc_ncm ipheth; do
      modprobe "$mod" 2>/dev/null || true
      grep -qx "$mod" /etc/modules 2>/dev/null || echo "$mod" >> /etc/modules
    done

    # Ensure eth0 keeps its DHCP address for SSH access at home.
    # On Bookworm, NetworkManager is the default — give eth0 a high-priority
    # wired connection so NM keeps it up and prefers it over tethered interfaces.
    nmcli con add type ethernet con-name "Wired ETH0" ifname eth0 \
      ipv4.method auto connection.autoconnect yes \
      connection.autoconnect-priority 100 2>/dev/null || true

    # Auto-connect USB tethering interfaces
    nmcli con delete "USB Tether" 2>/dev/null || true
    nmcli con add type ethernet con-name "USB Tether" ifname usb0 \
      ipv4.method auto connection.autoconnect yes \
      connection.autoconnect-priority 50 2>/dev/null || true

    # Auto-manage iPhone tethering interface (ipheth driver)
    cat > /etc/NetworkManager/conf.d/20-iphone-tether.conf << 'NMCONF'
[device-iphone]
match-device=driver:ipheth
managed=1
NMCONF

    # Udev rules — tell NM to manage hotplugged USB network devices
    cat > /etc/udev/rules.d/90-usb-tether.rules << 'UDEV'
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="rndis_host", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ether", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="cdc_ncm", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", DRIVERS=="ipheth", ENV{NM_UNMANAGED}="0"
ACTION=="add", SUBSYSTEM=="net", ATTRS{idVendor}=="05ac", ENV{NM_UNMANAGED}="0"
UDEV

    # Enable usbmuxd for iPhone USB communication
    systemctl enable usbmuxd 2>/dev/null || true

    # Enable Bluetooth
    systemctl enable bluetooth
  } >> "$LOG" 2>&1 || { echo "Enabling tethering support" > "$FAIL_FILE"; exit 1; }

  # --- 5. Configure auto-login on tty1 -------------------------------------
  echo "XXX"
  echo 55
  echo "Configuring auto-login..."
  echo "XXX"
  {
    mkdir -p /etc/systemd/system/getty@tty1.service.d
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin kiosk --noclear %I $TERM
EOF
  } >> "$LOG" 2>&1 || { echo "Configuring auto-login" > "$FAIL_FILE"; exit 1; }

  # --- 6. Configure X and Chromium kiosk startup ----------------------------
  echo "XXX"
  echo 65
  echo "Configuring kiosk startup..."
  echo "XXX"
  {
    # .bash_profile starts X on tty1
    cat > /home/kiosk/.bash_profile << 'PROFILE'
# Auto-start X on tty1 only
if [ "$(tty)" = "/dev/tty1" ]; then
  exec startx 2>/dev/null
fi
PROFILE

    # .xinitrc launches openbox + chromium
    cat > /home/kiosk/.xinitrc << 'XINITRC'
#!/bin/bash

# Read dashboard URL and append ?tv=1 for TV mode
URL=$(cat /home/kiosk/url.txt 2>/dev/null || echo "about:blank")
if [ "$URL" != "about:blank" ]; then
  URL="${URL%/}"
  case "$URL" in
    *\?*) URL="$URL&tv=1" ;;
    *)    URL="$URL?tv=1" ;;
  esac
fi

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Window manager (needed for Chromium to go fullscreen)
openbox &
sleep 1

# Clear any Chromium crash flags from unclean shutdown
CHROMIUM_DIR="/home/kiosk/.config/chromium/Default"
mkdir -p "$CHROMIUM_DIR"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_DIR/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROMIUM_DIR/Preferences" 2>/dev/null || true

# Refresh the page after 10 seconds to ensure full load
(sleep 10 && xdotool key F5) &

# Launch Chromium in kiosk mode
exec chromium \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-features=Translate \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-gpu-compositing \
  "$URL"
XINITRC

    chown kiosk:kiosk /home/kiosk/.bash_profile /home/kiosk/.xinitrc
    chmod +x /home/kiosk/.xinitrc
  } >> "$LOG" 2>&1 || { echo "Configuring kiosk startup" > "$FAIL_FILE"; exit 1; }

  # --- 7. Disable screen blanking at kernel level ---------------------------
  echo "XXX"
  echo 80
  echo "Disabling screen blanking..."
  echo "XXX"
  {
    CMDLINE="/boot/cmdline.txt"
    if [ -f /boot/firmware/cmdline.txt ]; then
      CMDLINE="/boot/firmware/cmdline.txt"
    fi
    if ! grep -q "consoleblank=0" "$CMDLINE"; then
      sed -i 's/$/ consoleblank=0/' "$CMDLINE"
    fi

    CONFIG="/boot/config.txt"
    if [ -f /boot/firmware/config.txt ]; then
      CONFIG="/boot/firmware/config.txt"
    fi
    if ! grep -q "^gpu_mem=" "$CONFIG"; then
      echo "gpu_mem=128" >> "$CONFIG"
    fi
  } >> "$LOG" 2>&1 || { echo "Disabling screen blanking" > "$FAIL_FILE"; exit 1; }

  # --- 8. Set hostname ------------------------------------------------------
  echo "XXX"
  echo 95
  echo "Setting hostname to mentor-kiosk..."
  echo "XXX"
  hostnamectl set-hostname mentor-kiosk >> "$LOG" 2>&1 || true

  echo "XXX"
  echo 100
  echo "Complete!"
  echo "XXX"
  sleep 1

) | whiptail --title "UV PitCrew Kiosk Setup" --gauge "Starting installation..." 8 "$W" 0 || true

# --------------------------------------------------------------------------
# Check for errors
# --------------------------------------------------------------------------
if [ -f "$FAIL_FILE" ]; then
  FAILED=$(cat "$FAIL_FILE")
  err "Installation failed at: $FAILED

Check the log for details:
  cat $LOG"
  exit 1
fi

# --------------------------------------------------------------------------
# Done — offer reboot
# --------------------------------------------------------------------------
if yesno "Setup complete!

  Dashboard: $DASHBOARD_URL
  Hostname:  mentor-kiosk
  Change URL: edit /home/kiosk/url.txt
  SSH:  ssh kiosk@mentor-kiosk.local
  TTY:  Ctrl+Alt+F2 (back: F1)

Reboot now?"; then
  reboot
fi
