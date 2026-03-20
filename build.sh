#!/bin/bash
set -e
cd "$(dirname "$0")"

BROWSER="${1:-all}"

echo "의존성 확인..."
pnpm install

case "$BROWSER" in
  chrome|edge|firefox)
    echo "$BROWSER 빌드 및 패키징..."
    pnpm zip:$BROWSER
    echo "완료: .output/ 폴더에서 zip 파일 확인"
    ;;
  all)
    echo "전체 브라우저 빌드 중..."
    pnpm zip:all
    echo "완료: .output/ 폴더에서 각 브라우저별 zip 확인"
    ;;
  *)
    echo "사용법: ./build.sh [chrome|edge|firefox|all]"
    exit 1
    ;;
esac
