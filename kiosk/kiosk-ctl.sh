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
    exec sudo -u "$KIOSK_USER" DISPLAY=:0 XAUTHORITY="/home/$KIOSK_USER/.Xauthority" "$0" "$@"
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
    sudo pkill -f chromium-browser || true
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

  status)
    echo "=== Kiosk Status ==="
    echo "URL:       $(cat "$URL_FILE" 2>/dev/null || echo 'not set')"
    echo "Chromium:  $(pgrep -c chromium 2>/dev/null || echo 0) process(es)"
    echo "Display:   ${DISPLAY:-not set}"
    echo "Uptime:    $(uptime -p)"
    echo "Memory:    $(free -h | awk '/Mem:/ {print $3 "/" $2}')"
    echo "Temp:      $(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"
    echo "Disk:      $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
    ;;

  help|*)
    echo "Usage: bash kiosk-ctl.sh <command>"
    echo ""
    echo "Commands:"
    echo "  url [new-url]   Show or change the dashboard URL"
    echo "  restart         Restart the kiosk browser"
    echo "  refresh         Reload the current page (F5)"
    echo "  screenshot      Take a screenshot to /tmp/"
    echo "  status          Show kiosk health info"
    echo "  help            Show this help"
    ;;
esac
