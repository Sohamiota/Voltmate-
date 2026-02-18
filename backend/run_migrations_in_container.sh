#!/bin/bash
set -e
for f in /migrations/*.sql; do
  echo "Applying $f"
  psql -U postgres -d postgres -f "$f"
done

