#!/usr/bin/env bash
# Сборка PDF дизайн-брифа «Шеф-стол»: md -> HTML (Python) -> PDF (Chrome headless).
# Работает на Mac, Linux и Windows (через WSL/Git Bash).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HTML="$DIR/design-brief.html"
PDF="$DIR/design-brief.pdf"

# === Поиск Chrome / Chromium ===
find_chrome() {
  # Mac
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return
  fi
  # Linux (разные варианты установки)
  for cmd in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$cmd" >/dev/null 2>&1; then
      command -v "$cmd"
      return
    fi
  done
  # Windows (через стандартные пути)
  if [ -x "/c/Program Files/Google/Chrome/Application/chrome.exe" ]; then
    echo "/c/Program Files/Google/Chrome/Application/chrome.exe"
    return
  fi
  if [ -x "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" ]; then
    echo "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    return
  fi
  echo ""
}

CHROME=$(find_chrome)

if [ -z "$CHROME" ]; then
  echo "❌ Ошибка: не найден Google Chrome / Chromium."
  echo "   Установите Chrome и повторите запуск."
  echo "   Mac: https://www.google.com/chrome/"
  echo "   Linux: sudo apt install chromium-browser"
  echo "   Windows: https://www.google.com/chrome/"
  exit 1
fi

echo "==> 1/2  Сборка HTML"
python3 "$DIR/build.py"

echo "==> 2/2  Печать в PDF (Chrome headless)"
echo "   Chrome: $CHROME"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PDF" "file://$HTML" 2>/dev/null

echo ""
echo "✅ Готово: $PDF"
ls -lh "$PDF" | awk '{print "   Размер:", $5}'
