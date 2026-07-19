#!/usr/bin/env bash
# src/native/media-key/build.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/../../resources"
mkdir -p "$OUT"
swiftc -O "$DIR/mediakey.swift" -o "$OUT/mediakey"
echo "Built $OUT/mediakey"
