#!/bin/bash
# ============================================================================
# kiosk-ctl — Quick commands for managing the kiosk Pi
# ============================================================================
# Run on the Pi itself: bash kiosk-ctl.sh <command>

set -euo pipefail

CMD="${1:-help}"
URL_FILE="/home/kiosk/url.txt"

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
    export DISPLAY=:0
    xdotool key F5 2>/dev/null && echo "Page refreshed" || echo "Install xdotool: sudo apt install xdotool"
    ;;

  screenshot)
    # Take a screenshot (useful for remote debugging)
    export DISPLAY=:0
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
