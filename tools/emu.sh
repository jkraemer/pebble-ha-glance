#!/usr/bin/env bash
# Drives the app in a headless Pebble Time 2 emulator. The emulator only ever
# gets a build made with dev/settings.json, which talks to the stand-in Home
# Assistant (tools/fake_ha.js), or one without settings: buttons pressed here
# must not reach the house.
#
#   tools/emu.sh install                 build with the dev settings, install and start
#   tools/emu.sh install-unconfigured    the same without settings, as from the appstore
#   tools/emu.sh shot FILE.png           save a screenshot
#   tools/emu.sh click up|select|down    press a button
#   tools/emu.sh send KEY=VALUE...       send the app a message, as the phone would
#   tools/emu.sh kill                    stop the emulator
#
# Message keys are written as in package.json, array entries with their index:
#   tools/emu.sh send VALUE_COUNT=1 CAPTION0=Battery VALUE0=96 UNIT0=% BUTTON0=Movie
set -euo pipefail
cd "$(dirname "$0")/.."

EMULATOR=(--emulator emery --vnc)
INT_KEYS=" REFRESH PRESS VALUE_COUNT SUCCEEDED FAILED SETUP_NEEDED "

# The pebble tool prints Python warnings of its own on every run.
quiet() {
  "$@" 2>&1 | grep -v -e SyntaxWarning -e 'Represents a list' || true
}

send() {
  local ints=() strings=()
  for pair in "$@"; do
    local key=${pair%%=*} value=${pair#*=}
    local name=${key%%[0-9]*} index=${key##*[A-Z_]}
    local number=$(( $(jq ".$name" build/js/message_keys.json) + ${index:-0} ))
    if [[ $INT_KEYS == *" $name "* ]]; then
      ints+=("$number=$value")
    else
      strings+=("$number=$value")
    fi
  done
  quiet pebble send-app-message "${EMULATOR[@]}" --app-uuid "$(jq -r .pebble.uuid package.json)" \
    ${ints:+--int "${ints[@]}"} ${strings:+--string "${strings[@]}"}
}

# Builds with the given settings file, or none, and installs into the emulator.
install() {
  # The development build must not be mistaken for the one to put on the watch.
  trap 'rm -f build/*.pbw src/pkjs/preset.json' EXIT
  GLANCE_SETTINGS=$1 pebble build > /dev/null 2>&1 || { echo "the build failed, see pebble build"; exit 1; }
  quiet pebble install "${EMULATOR[@]}"
}

case ${1:-} in
  install) install dev/settings.json ;;
  install-unconfigured) install "" ;;
  shot) quiet pebble screenshot "${EMULATOR[@]}" --no-open "$2" ;;
  click) quiet pebble emu-button "${EMULATOR[@]}" click "$2" ;;
  send) shift; send "$@" ;;
  kill) quiet pebble kill ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
