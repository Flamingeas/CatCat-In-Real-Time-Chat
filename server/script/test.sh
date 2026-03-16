#!/usr/bin/env bash
set -euo pipefail

export TEST_DATABASE_URL="postgresql://postgres:epitech@127.0.0.1:5432/catcat"
unset DATABASE_URL

cd ../ && cargo tarpaulin --out Html --ignore-tests --exclude-files 'target/*' -- --test-threads=1