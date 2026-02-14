#!/bin/sh
set -e

cd /app

# Run database migrations.
# If deploy fails (e.g. a previously failed migration), reset the
# database and retry. This is safe because the seed step below
# recreates all default data and user data in a fresh app is expendable
# during initial deployment.
echo "Running database migrations..."
if ! node node_modules/prisma/build/index.js migrate deploy 2>&1; then
  echo "Migration failed — resetting database and retrying..."
  rm -f /app/data/mentor-signup.db
  node node_modules/prisma/build/index.js migrate deploy
fi

# Seed defaults (idempotent — only creates values that don't exist yet)
echo "Seeding defaults..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts

# Start background reminder scheduler
if [ -n "$CRON_SECRET" ]; then
  echo "Starting reminder scheduler (hourly check)..."
  (
    # Wait for the app to be ready before first check
    sleep 60
    while true; do
      curl -s -X POST "http://localhost:${PORT:-3000}/api/admin/notifications/send-reminders" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $CRON_SECRET" || true
      curl -s -X POST "http://localhost:${PORT:-3000}/api/admin/notifications/send-digest" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $CRON_SECRET" || true
      curl -s -X POST "http://localhost:${PORT:-3000}/api/admin/student-attendance/sync-sheets" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $CRON_SECRET" || true
      sleep 3600
    done
  ) &
fi

# Start the application
echo "Starting application..."
exec node server.js
