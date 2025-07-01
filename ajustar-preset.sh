#!/bin/bash
# Ciclar entre presets de layout
PRESET_FILE="build/.current-preset"
CURRENT=1
[ -f "$PRESET_FILE" ] && CURRENT=$(cat "$PRESET_FILE")

NEXT=$((CURRENT + 1))
[ $NEXT -gt 3 ] && NEXT=1

mkdir -p build
echo $NEXT > "$PRESET_FILE"

echo "🔧 Mudando para preset #$NEXT"
npm run build:pdf