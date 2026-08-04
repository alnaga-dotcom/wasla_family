#!/bin/bash
# Start Wasla server in production mode
set -e

export NODE_ENV=production
export WASLA_DEV_OTP=false

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

node src/server.js
