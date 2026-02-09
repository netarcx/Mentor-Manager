#!/bin/sh
set -e

cd /app

# Run database migrations
echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

# Seed database on first run
if [ ! -f /app/data/.seeded ]; then
  echo "Seeding database..."
  node node_modules/tsx/dist/cli.mjs prisma/seed.ts
  touch /app/data/.seeded
fi

# Start the application
echo "Starting application..."
exec node server.js
