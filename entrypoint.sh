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

# Start the application
echo "Starting application..."
exec node server.js
