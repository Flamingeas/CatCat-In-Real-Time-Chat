#!/usr/bin/env bash
sudo -u postgres pg_dump -C --schema-only -d catcat > ../../NotDeliverable/catcat.sql