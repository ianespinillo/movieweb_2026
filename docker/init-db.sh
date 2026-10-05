#!/bin/sh
set -e

echo "=========================================="
echo "Initializing PostgreSQL Database: movies"
echo "=========================================="

cd /docker-db-scripts

echo "-> Executing 00_load_all.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f 00_load_all.sql

echo "-> Executing 13_users.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f 13_users.sql

echo "=========================================="
echo "PostgreSQL initialization complete!"
echo "=========================================="
