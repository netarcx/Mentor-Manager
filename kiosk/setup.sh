#!/bin/bash
# ============================================================================
# Mentor Manager — Raspberry Pi Kiosk Setup
# ============================================================================
#
# Turns a Raspberry Pi 3 into a dedicated kiosk that auto-boots into the
# Mentor Manager dashboard in fullscreen Chromium.
#
# Prerequisites:
#   1. Flash Raspberry Pi OS Lite (Bookworm, 32-bit) to an SD card
#   2. Enable SSH and configure Wi-Fi via Raspberry Pi Imager (or raspi-config)
#   3. Boot the Pi and SSH in
#   4. Copy this script to the Pi and run it:
#
#        bash setup.sh https://your-server-address/dashboard
#
#   5. The Pi will reboot and launch the dashboard in fullscreen.
#
# To change the URL later:
#   Edit /home/kiosk/url.txt and reboot (or run: sudo systemctl restart kiosk)
#
# To exit kiosk mode on a connected keyboard:
#   Ctrl+Alt+F2  → switch to tty2, log in, and run commands
#   Ctrl+Alt+F1  → switch back to kiosk
#
# ============================================================================

set -euo pipefail

DASHBOARD_URL="${1:-}"

if [ -z "$DASHBOARD_URL" ]; then
  echo "Usage: bash setup.sh <dashboard-url>"
  echo "  e.g. bash setup.sh https://mentors.example.com/dashboard"
  exit 1
fi

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash setup.sh $DASHBOARD_URL"
  exit 1
fi

echo "=== Mentor Manager Kiosk Setup ==="
echo "URL: $DASHBOARD_URL"
echo ""

# --------------------------------------------------------------------------
# 1. Create a dedicated kiosk user
# --------------------------------------------------------------------------
echo "[1/7] Creating kiosk user..."
if ! id -u kiosk &>/dev/null; then
  useradd -m -s /bin/bash kiosk
  usermod -aG video,audio,input,tty kiosk
fi

# Save the dashboard URL so it's easy to change later
echo "$DASHBOARD_URL" > /home/kiosk/url.txt
chown kiosk:kiosk /home/kiosk/url.txt

# --------------------------------------------------------------------------
# 2. Install packages
# --------------------------------------------------------------------------
echo "[2/7] Installing packages (this may take a few minutes)..."
apt-get update -qq
apt-get install -y -qq \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  chromium-browser \
  unclutter \
  fonts-liberation \
  libgles2 \
  > /dev/null

# --------------------------------------------------------------------------
# 3. Configure auto-login on tty1
# --------------------------------------------------------------------------
echo "[3/7] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin kiosk --noclear %I $TERM
EOF

# --------------------------------------------------------------------------
# 4. Configure X and Chromium kiosk startup
# --------------------------------------------------------------------------
echo "[4/7] Configuring kiosk startup..."

# The kiosk user's .bash_profile starts X on tty1
cat > /home/kiosk/.bash_profile << 'PROFILE'
# Auto-start X on tty1 only
if [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor 2>/dev/null
fi
PROFILE

# .xinitrc launches openbox + chromium
cat > /home/kiosk/.xinitrc << 'XINITRC'
#!/bin/bash

# Read dashboard URL
URL=$(cat /home/kiosk/url.txt 2>/dev/null || echo "about:blank")

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide the mouse cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Window manager (needed for Chromium to go fullscreen)
openbox &
sleep 1

# Clear any Chromium crash flags from unclean shutdown
CHROMIUM_DIR="/home/kiosk/.config/chromium/Default"
mkdir -p "$CHROMIUM_DIR"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROMIUM_DIR/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROMIUM_DIR/Preferences" 2>/dev/null || true

# Launch Chromium in kiosk mode
exec chromium-browser \
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

# --------------------------------------------------------------------------
# 5. Systemd service for easy restart / management
# --------------------------------------------------------------------------
echo "[5/7] Creating systemd service..."
cat > /etc/systemd/system/kiosk.service << 'SERVICE'
[Unit]
Description=Mentor Manager Kiosk
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=kiosk
Environment=DISPLAY=:0
ExecStart=/usr/bin/startx -- -nocursor
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# We use the auto-login approach rather than the service, but keep the
# service available for manual restart: sudo systemctl restart kiosk

# --------------------------------------------------------------------------
# 6. Disable screen blanking at kernel level
# --------------------------------------------------------------------------
echo "[6/7] Disabling screen blanking..."

# Add kernel params to prevent blanking
CMDLINE="/boot/cmdline.txt"
# Also check /boot/firmware/cmdline.txt (Bookworm)
if [ -f /boot/firmware/cmdline.txt ]; then
  CMDLINE="/boot/firmware/cmdline.txt"
fi

if ! grep -q "consoleblank=0" "$CMDLINE"; then
  sed -i 's/$/ consoleblank=0/' "$CMDLINE"
fi

# GPU memory split — give more to GPU for smooth rendering
CONFIG="/boot/config.txt"
if [ -f /boot/firmware/config.txt ]; then
  CONFIG="/boot/firmware/config.txt"
fi

if ! grep -q "^gpu_mem=" "$CONFIG"; then
  echo "gpu_mem=128" >> "$CONFIG"
fi

# --------------------------------------------------------------------------
# 7. Optional: set hostname
# --------------------------------------------------------------------------
echo "[7/7] Setting hostname to mentor-kiosk..."
hostnamectl set-hostname mentor-kiosk 2>/dev/null || true

# --------------------------------------------------------------------------
# Done!
# --------------------------------------------------------------------------
echo ""
echo "=== Setup complete! ==="
echo ""
echo "The Pi will now reboot into the dashboard kiosk."
echo ""
echo "  Dashboard URL: $DASHBOARD_URL"
echo "  Change URL:    Edit /home/kiosk/url.txt and reboot"
echo "  SSH in:        ssh kiosk@mentor-kiosk.local"
echo "  Switch TTY:    Ctrl+Alt+F2 (exit kiosk: Ctrl+Alt+F1 to return)"
echo ""
read -p "Reboot now? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  reboot
fi
