#!/usr/bin/env bash
# Builds a signed, universal (Apple Silicon + Intel) Desk Pet release into
# app/release/<version>/:
#   DeskPet-<version>.dmg          for first-time installs
#   DeskPet.app.tar.gz             what the in-app updater downloads
#   latest.json                    the manifest the updater reads
#
# Usage (from app/):
#   npm run release -- "What's new"           real release, for GitHub Releases
#   npm run release -- --local "What's new"   test build: looks for updates at
#                                             http://localhost:8765 instead
#
# Needs the update key at ~/.tauri/desk-pet.key (asks for its password) and the
# "Desk Pet Signing" certificate in your login keychain.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="MariaC27/desk-pet"
KEY="$HOME/.tauri/desk-pet.key"
LOCAL_URL="http://localhost:8765"

local=false
if [[ "${1:-}" == "--local" ]]; then
  local=true
  shift
fi
notes="${1:-}"

version=$(node -p 'require("./src-tauri/tauri.conf.json").version')

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
  read -rsp "Update key password: " TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  echo
fi
export TAURI_SIGNING_PRIVATE_KEY="$KEY" TAURI_SIGNING_PRIVATE_KEY_PASSWORD

extra=()
if $local; then
  out="release/$version-local"
  base="$LOCAL_URL"
  export DESK_PET_UPDATE_URL="$LOCAL_URL/latest.json"
  extra=(--config '{"plugins":{"updater":{"dangerousInsecureTransportProtocol":true}}}')
else
  out="release/$version"
  base="https://github.com/$REPO/releases/download/v$version"
  unset DESK_PET_UPDATE_URL
fi

npx tauri build --target universal-apple-darwin ${extra[@]+"${extra[@]}"}

bundle="src-tauri/target/universal-apple-darwin/release/bundle"
rm -rf "$out"
mkdir -p "$out"
# Re-pack the dmg without Tauri's signature: macOS rejects disk images signed
# by a certificate it can't verify ("Apple could not verify…"), but opens
# unsigned ones. The app inside stays signed, so it's checked once on first launch.
hdiutil convert "$bundle"/dmg/*.dmg -format UDZO -o "$out/DeskPet-$version.dmg" >/dev/null
cp "$bundle/macos/Desk Pet.app.tar.gz" "$out/DeskPet.app.tar.gz"

SIG="$(cat "$bundle/macos/Desk Pet.app.tar.gz.sig")" URL="$base/DeskPet.app.tar.gz" \
  VERSION="$version" NOTES="$notes" node -e '
    const { SIG: signature, URL: url, VERSION: version, NOTES: notes } = process.env;
    const platform = { signature, url };
    console.log(JSON.stringify({
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: { "darwin-aarch64": platform, "darwin-x86_64": platform },
    }, null, 2));
  ' > "$out/latest.json"

echo
echo "Built Desk Pet $version in app/$out:"
ls -lh "$out"
echo
if $local; then
  echo "To serve it as an update: cd app/$out && python3 -m http.server 8765"
else
  echo "To publish (from the repo root):"
  echo "  gh release create v$version app/$out/* --title \"Desk Pet $version\" --notes \"$notes\""
fi
