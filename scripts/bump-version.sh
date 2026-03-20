#!/bin/bash
# ViewPilot 버전 범프 스크립트
# Usage:
#   ./scripts/bump-version.sh          # patch: 1.0.3 → 1.0.4
#   ./scripts/bump-version.sh minor    # minor: 1.0.3 → 1.1.0
#   ./scripts/bump-version.sh major    # major: 1.0.3 → 2.0.0

set -e

PKG="package.json"
LEVEL="${1:-patch}"

CURRENT=$(grep -o '"version": "[^"]*"' "$PKG" | head -1 | grep -o '[0-9]*\.[0-9]*\.[0-9]*')

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$LEVEL" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"

# package.json 업데이트
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PKG"
else
  sed -i "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW}\"/" "$PKG"
fi

echo "${CURRENT} → ${NEW} (${LEVEL})"
