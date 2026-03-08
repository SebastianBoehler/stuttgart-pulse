#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
SESSION="spvis"
ROOT_DIR="$(pwd)"
OUTPUT_DIR="${ROOT_DIR}/output/playwright"

mkdir -p "$OUTPUT_DIR"

if [[ ! -x "$PWCLI" ]]; then
  echo "Playwright wrapper not found at $PWCLI" >&2
  exit 1
fi

pages=(
  "/de"
  "/de/explorer"
  "/de/compare"
  "/de/about"
  "/en/explorer"
)

themes=(light dark system)

set_theme() {
  local theme="$1"
  if [[ "$theme" == "system" ]]; then
    "$PWCLI" --session "$SESSION" localstorage-delete theme >/dev/null
  else
    "$PWCLI" --session "$SESSION" localstorage-set theme "$theme" >/dev/null
  fi
}

capture() {
  local route="$1"
  local theme="$2"
  local viewport="$3"
  local width="$4"
  local height="$5"

  local name
  name="$(echo "${route#/}" | tr '/' '-' | sed 's/^-//')"
  [[ -z "$name" ]] && name="root"

  "$PWCLI" --session "$SESSION" resize "$width" "$height" >/dev/null
  "$PWCLI" --session "$SESSION" goto "${BASE_URL}${route}" >/dev/null
  "$PWCLI" --session "$SESSION" run-code "await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2200);" >/dev/null
  set_theme "$theme"
  "$PWCLI" --session "$SESSION" reload >/dev/null
  "$PWCLI" --session "$SESSION" run-code "await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(2200);" >/dev/null
  local screenshot_output
  screenshot_output="$("$PWCLI" --session "$SESSION" screenshot)"

  local source_path
  source_path="$(printf '%s\n' "$screenshot_output" | sed -n "s/.*](\\(.playwright-cli\\/[^)]*\\.png\\)).*/\\1/p" | tail -n 1)"

  if [[ -z "$source_path" || ! -f "$ROOT_DIR/$source_path" ]]; then
    echo "Failed to resolve screenshot output for ${route} (${theme}, ${viewport})" >&2
    exit 1
  fi

  cp "$ROOT_DIR/$source_path" "${OUTPUT_DIR}/${name}-${theme}-${viewport}.png"
}

"$PWCLI" --session "$SESSION" open "${BASE_URL}/de" >/dev/null

for theme in "${themes[@]}"; do
  for route in "${pages[@]}"; do
    capture "$route" "$theme" "desktop" 1440 1200
  done
  capture "/de/explorer" "$theme" "mobile" 430 932
done

"$PWCLI" --session "$SESSION" close >/dev/null || true

echo "Saved visual QA screenshots to ${OUTPUT_DIR}"
