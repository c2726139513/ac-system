#!/bin/sh
set -e

echo "Running database migration..."
npx prisma generate
npx prisma db push

echo "Starting application..."
exec next start
