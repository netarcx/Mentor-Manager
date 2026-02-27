#!/bin/bash
# ============================================================================
# kiosk-ctl — Quick commands for managing the kiosk Pi
# ============================================================================
# Run on the Pi itself: bash kiosk-ctl.sh <command>

set -euo pipefail

CMD="${1:-help}"
URL_FILE="/home/kiosk/url.txt"
KIOSK_USER="kiosk"

# Commands that need X access must run as the kiosk user
run_as_kiosk() {
  if [ "$(id -u)" -ne "$(id -u "$KIOSK_USER" 2>/dev/null || echo -1)" ]; then
    exec sudo -u "$KIOSK_USER" env DISPLAY=:0 XAUTHORITY="/home/$KIOSK_USER/.Xauthority" "$0" "$@"
  fi
  export DISPLAY=:0
  export XAUTHORITY="/home/$KIOSK_USER/.Xauthority"
}

case "$CMD" in
  url)
    # Show or set the dashboard URL
    if [ -n "${2:-}" ]; then
      echo "$2" | sudo tee "$URL_FILE" > /dev/null
      echo "URL set to: $2"
      echo "Reboot to apply: sudo reboot"
    else
      cat "$URL_FILE" 2>/dev/null || echo "(not set)"
    fi
    ;;

  restart)
    # Restart the kiosk (kills Chromium, X restarts it)
    echo "Restarting kiosk..."
    sudo pkill -f chromium || true
    ;;

  refresh)
    # Send F5 to Chromium to reload the page
    if ! command -v xdotool &>/dev/null; then
      echo "Install xdotool: sudo apt install xdotool"
      exit 1
    fi
    run_as_kiosk "$@"
    xdotool key F5 && echo "Page refreshed" || echo "xdotool failed — is Chromium running?"
    ;;

  screenshot)
    # Take a screenshot (useful for remote debugging)
    run_as_kiosk "$@"
    DEST="/tmp/kiosk-screenshot.png"
    if command -v scrot &>/dev/null; then
      scrot "$DEST" && echo "Screenshot saved to $DEST"
    else
      echo "Install scrot: sudo apt install scrot"
    fi
    ;;

  tether)
    # Show network/tethering status or scan for Bluetooth devices
    case "${2:-status}" in
      scan)
        echo "Scanning for Bluetooth devices (10s)..."
        timeout 10 bluetoothctl scan on 2>/dev/null || true
        bluetoothctl devices
        ;;
      pair)
        if [ -z "${3:-}" ]; then
          echo "Usage: kiosk-ctl.sh tether pair <MAC>"
          echo "Run 'kiosk-ctl.sh tether scan' first to find devices"
          exit 1
        fi
        echo "Pairing with $3..."
        bluetoothctl pair "$3"
        bluetoothctl trust "$3"
        echo "Paired. Enable Bluetooth tethering on your phone, then run:"
        echo "  kiosk-ctl.sh tether connect $3"
        ;;
      connect)
        if [ -z "${3:-}" ]; then
          echo "Usage: kiosk-ctl.sh tether connect <MAC>"
          exit 1
        fi
        echo "Connecting BT PAN to $3..."
        nmcli dev disconnect bnep0 2>/dev/null || true
        bluetoothctl connect "$3"
        sleep 3
        nmcli dev connect bnep0 && echo "Connected" || echo "Failed — is BT tethering enabled on the phone?"
        ;;
      status|*)
        echo "=== Tethering Status ==="
        echo "NetworkManager: $(systemctl is-active NetworkManager 2>/dev/null || echo 'inactive')"
        echo "Bluetooth:      $(systemctl is-active bluetooth 2>/dev/null || echo 'inactive')"
        echo ""
        echo "Network connections:"
        nmcli -t -f NAME,TYPE,DEVICE,STATE con show --active 2>/dev/null || echo "  (NetworkManager not running)"
        echo ""
        echo "Bluetooth devices:"
        bluetoothctl devices 2>/dev/null || echo "  (bluetoothctl not available)"
        ;;
    esac
    ;;

  status)
    echo "=== Kiosk Status ==="
    echo "URL:       $(cat "$URL_FILE" 2>/dev/null || echo 'not set')"
    echo "Chromium:  $(pgrep -c chromium 2>/dev/null || echo 0) process(es)"
    echo "Display:   ${DISPLAY:-not set}"
    echo "Uptime:    $(uptime -p)"
    echo "Memory:    $(free -h | awk '/Mem:/ {print $3 "/" $2}')"
    echo "Temp:      $(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"
    echo "Disk:      $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
    echo "Network:   $(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | head -3 || echo 'N/A')"
    ;;

  help|*)
    echo "Usage: bash kiosk-ctl.sh <command>"
    echo ""
    echo "Commands:"
    echo "  url [new-url]      Show or change the dashboard URL"
    echo "  restart            Restart the kiosk browser"
    echo "  refresh            Reload the current page (F5)"
    echo "  screenshot         Take a screenshot to /tmp/"
    echo "  tether [subcmd]    Manage tethering connections"
    echo "    tether status      Show network & Bluetooth status"
    echo "    tether scan        Scan for Bluetooth devices"
    echo "    tether pair <MAC>  Pair a Bluetooth device"
    echo "    tether connect <MAC> Connect BT PAN tethering"
    echo "  status             Show kiosk health info"
    echo "  help               Show this help"
    ;;
esac
