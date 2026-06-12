#!/bin/sh
set -e

echo "Running database migration..."
npx prisma generate
npx prisma db push

echo "Starting application..."
exec npx next start
