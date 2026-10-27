#!/usr/bin/env bash
# End-to-end check in the Pebble Time 2 emulator: the real watch binary and
# phone-side script, first without settings as it comes from the appstore,
# then built with dev/settings.json, against the stand-in Home Assistant. What
# the screen shows is compared with the pictures in test/screens; a screen
# that differs is saved next to them as NAME.actual.png.
set -euo pipefail
cd "$(dirname "$0")/.."

SCREENS=test/screens
WAIT_S=25

requests=$(mktemp)
node tools/fake_ha.js > "$requests" &
server=$!
trap 'kill $server; rm -f "$requests"' EXIT

fail() {
  echo "not ok - emulator: $1"
  exit 1
}

# Waits until the screen looks like the named picture.
expect_screen() {
  local expected=$SCREENS/$1.png actual=$SCREENS/$1.actual.png deadline=$((SECONDS + WAIT_S))
  while true; do
    tools/emu.sh shot "$actual" > /dev/null
    if cmp -s "$expected" "$actual"; then
      rm "$actual"
      return
    fi
    [[ $SECONDS -lt $deadline ]] || fail "the screen is not $1, see $actual"
  done
}

# Waits until the stand-in Home Assistant has received the given request.
expect_request() {
  local deadline=$((SECONDS + WAIT_S))
  until grep -qF "$1" "$requests"; do
    [[ $SECONDS -lt $deadline ]] || fail "Home Assistant never got: $1"
    read -rt 0.5 <> <(:) || true
  done
}

# Gives an entity of the stand-in Home Assistant another state.
set_state() {
  curl -sf -X POST "http://127.0.0.1:8377/api/states/$1" \
    -H 'Authorization: Bearer dev-token' -d "{\"state\": \"$2\"}" > /dev/null
}

# Without settings the watch asks for them, and buttons do nothing.
tools/emu.sh install-unconfigured > /dev/null || fail "the app could not be built and installed"
expect_screen setup-needed
tools/emu.sh click up > /dev/null
expect_screen setup-needed-press-failed
! grep -q /api/ "$requests" || fail "Home Assistant was asked without settings: $(grep /api/ "$requests")"

tools/emu.sh install > /dev/null || fail "the app could not be built and installed"

expect_screen four-values

# Pressing a button makes the phone read the values again, so a state that
# changed in the meantime shows.
set_state alarm_control_panel.home_alarm arming
tools/emu.sh click up > /dev/null
expect_request 'POST /api/services/script/turn_on {"entity_id":"script.movie_night"}'
expect_screen alarm-arming

set_state alarm_control_panel.home_alarm disarmed
tools/emu.sh click select > /dev/null
expect_request 'POST /api/services/automation/trigger {"entity_id":"automation.water_garden"}'
expect_screen four-values

tools/emu.sh click down > /dev/null
expect_request 'POST /api/services/switch/toggle {"entity_id":"switch.fan"}'
expect_screen four-values

# A state too long for the watch is cut, not lost: sent whole, this one would
# not fit the watch's inbox.
set_state sensor.outside_temperature "$(printf 'Rain in the afternoon, then clear skies. %.0s' $(seq 13))"
tools/emu.sh click down > /dev/null
expect_screen long-value

echo "ok - emulator"
