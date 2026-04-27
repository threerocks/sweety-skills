#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="${ROOT_DIR}/skills"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required."
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- --all
fi

exec node "${ROOT_DIR}/scripts/sync-clawhub.mjs" --root "${SKILLS_DIR}" "$@"
