#!/bin/sh

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Start the Next.js production server
echo "Starting Next.js server..."
pnpm start
