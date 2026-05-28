#!/bin/sh
set -e
apt-get update -y -qq && apt-get install -y -qq openssl

cd /seed

# Instalar solo lo necesario para el seed
npm install --silent prisma@5 @prisma/client@5 tsx bcrypt 2>/dev/null

# Generar el cliente Prisma para Linux
export DATABASE_URL="postgresql://thesis:supersecret123@postgres:5432/thesis_review"
node_modules/.bin/prisma generate --schema=schema.prisma

# Ejecutar el seed
node_modules/.bin/tsx seed.ts
