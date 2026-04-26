#!/usr/bin/env bash
set -euo pipefail

export TEST_DATABASE_URL="postgresql://postgres:epitech@127.0.0.1:5432/catcat"
unset DATABASE_URL

cd ../ && cargo tarpaulin \
  -p rtc_backend \
  --out Html \
  --ignore-tests \
  --exclude-files \
    'target/*' \
    'client/*' \
    'server/src/main.rs' \
    'server/src/modules/*/repository.rs' \
    'server/src/modules/*/route.rs' \
  -- --test-threads=1
