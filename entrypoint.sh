#!/bin/sh
set -e

cd /app

# Run database migrations
echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

# Seed defaults (idempotent — only creates values that don't exist yet)
echo "Seeding defaults..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts

# Start the application
echo "Starting application..."
exec node server.js
