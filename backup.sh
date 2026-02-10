#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
LOCAL_DATA_DIR="$SCRIPT_DIR/data"
LOCAL_DB="$LOCAL_DATA_DIR/mentor-signup.db"
CONTAINER_DATA="/app/data"
CONTAINER_DB="$CONTAINER_DATA/mentor-signup.db"

# Detect if the app is running in Docker
get_container_id() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps -q app 2>/dev/null || true
}

is_docker() {
  local cid
  cid=$(get_container_id)
  [[ -n "$cid" ]]
}

usage() {
  echo "Usage: $0 {backup|restore|list}"
  echo ""
  echo "Commands:"
  echo "  backup              Create a timestamped backup of the database"
  echo "  restore <file>      Restore database from a backup file"
  echo "  restore latest      Restore from the most recent backup"
  echo "  list                List available backups"
  echo ""
  echo "Backups are stored in: $BACKUP_DIR"
  exit 1
}

do_backup() {
  mkdir -p "$BACKUP_DIR"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$BACKUP_DIR/mentor-signup_${timestamp}.db"

  if is_docker; then
    local cid
    cid=$(get_container_id)
    echo "Backing up from Docker container..."
    docker cp "$cid:$CONTAINER_DB" "$backup_file"
    # Also backup the logo if it exists
    if docker exec "$cid" test -f "$CONTAINER_DATA/logo.png" 2>/dev/null; then
      docker cp "$cid:$CONTAINER_DATA/logo.png" "$BACKUP_DIR/logo_${timestamp}.png"
      echo "Logo backed up to: backups/logo_${timestamp}.png"
    fi
  else
    if [[ ! -f "$LOCAL_DB" ]]; then
      echo "Error: Database not found at $LOCAL_DB"
      echo "Is the app running locally? If using Docker, start it first with: docker compose up -d"
      exit 1
    fi
    echo "Backing up local database..."
    cp "$LOCAL_DB" "$backup_file"
    if [[ -f "$LOCAL_DATA_DIR/logo.png" ]]; then
      cp "$LOCAL_DATA_DIR/logo.png" "$BACKUP_DIR/logo_${timestamp}.png"
      echo "Logo backed up to: backups/logo_${timestamp}.png"
    fi
  fi

  local size
  size=$(du -h "$backup_file" | cut -f1)
  echo "Database backed up to: backups/mentor-signup_${timestamp}.db ($size)"
}

do_restore() {
  local backup_file="$1"

  if [[ "$backup_file" == "latest" ]]; then
    backup_file=$(ls -t "$BACKUP_DIR"/mentor-signup_*.db 2>/dev/null | head -1)
    if [[ -z "$backup_file" ]]; then
      echo "Error: No backups found in $BACKUP_DIR"
      exit 1
    fi
    echo "Using latest backup: $(basename "$backup_file")"
  else
    # Allow specifying just the filename without the full path
    if [[ ! -f "$backup_file" && -f "$BACKUP_DIR/$backup_file" ]]; then
      backup_file="$BACKUP_DIR/$backup_file"
    fi
  fi

  if [[ ! -f "$backup_file" ]]; then
    echo "Error: Backup file not found: $backup_file"
    exit 1
  fi

  local size
  size=$(du -h "$backup_file" | cut -f1)
  echo "Restoring from: $(basename "$backup_file") ($size)"

  # Find matching logo backup if one exists
  local timestamp
  timestamp=$(basename "$backup_file" | sed 's/mentor-signup_//;s/\.db//')
  local logo_backup="$BACKUP_DIR/logo_${timestamp}.png"

  read -r -p "This will overwrite the current database. Continue? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Restore cancelled."
    exit 0
  fi

  if is_docker; then
    local cid
    cid=$(get_container_id)
    echo "Restoring to Docker container..."
    docker cp "$backup_file" "$cid:$CONTAINER_DB"
    if [[ -f "$logo_backup" ]]; then
      docker cp "$logo_backup" "$cid:$CONTAINER_DATA/logo.png"
      echo "Logo restored."
    fi
    echo "Restarting container to pick up changes..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" restart app
  else
    mkdir -p "$LOCAL_DATA_DIR"
    cp "$backup_file" "$LOCAL_DB"
    if [[ -f "$logo_backup" ]]; then
      cp "$logo_backup" "$LOCAL_DATA_DIR/logo.png"
      echo "Logo restored."
    fi
    echo "Restart the dev server to pick up changes."
  fi

  echo "Database restored successfully."
}

do_list() {
  if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR"/*.db 2>/dev/null)" ]]; then
    echo "No backups found. Run '$0 backup' to create one."
    exit 0
  fi

  echo "Available backups:"
  echo ""
  printf "%-40s %8s  %s\n" "FILENAME" "SIZE" "HAS LOGO"
  printf "%-40s %8s  %s\n" "--------" "----" "--------"
  for f in $(ls -t "$BACKUP_DIR"/mentor-signup_*.db 2>/dev/null); do
    local name size has_logo timestamp
    name=$(basename "$f")
    size=$(du -h "$f" | cut -f1)
    timestamp=$(echo "$name" | sed 's/mentor-signup_//;s/\.db//')
    if [[ -f "$BACKUP_DIR/logo_${timestamp}.png" ]]; then
      has_logo="yes"
    else
      has_logo="no"
    fi
    printf "%-40s %8s  %s\n" "$name" "$size" "$has_logo"
  done
  echo ""
  echo "Restore with: $0 restore <filename>"
  echo "   or simply: $0 restore latest"
}

# Main
case "${1:-}" in
  backup)  do_backup ;;
  restore)
    if [[ -z "${2:-}" ]]; then
      echo "Error: Specify a backup file or 'latest'"
      echo "Usage: $0 restore <file|latest>"
      exit 1
    fi
    do_restore "$2"
    ;;
  list)    do_list ;;
  *)       usage ;;
esac
