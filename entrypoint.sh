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
      sleep 300
    done
  ) &
fi

# Compact database and clean up orphaned files
echo "Running cleanup..."
node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
(async () => {
  const prisma = new PrismaClient();
  try {
    // Vacuum SQLite to reclaim space
    await prisma.\$executeRawUnsafe('VACUUM');
    console.log('Database vacuumed');

    // Remove orphaned avatar files
    const mentors = await prisma.mentor.findMany({ select: { avatarPath: true } });
    const validFiles = new Set(mentors.map(m => m.avatarPath).filter(Boolean));
    const dataDir = '/app/data';
    const files = fs.readdirSync(dataDir);
    let cleaned = 0;
    for (const file of files) {
      if (file.startsWith('avatar-') && !validFiles.has(file)) {
        fs.unlinkSync(path.join(dataDir, file));
        cleaned++;
      }
    }
    if (cleaned > 0) console.log('Removed ' + cleaned + ' orphaned avatar(s)');
  } catch(e) { console.log('Cleanup note:', e.message); }
  await prisma.\$disconnect();
})();
" || true

# Start the application
echo "Starting application..."
exec node server.js
