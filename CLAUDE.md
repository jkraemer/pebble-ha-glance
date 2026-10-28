# HA Glance

Pebble Time 2 watch app showing Home Assistant values and three action
buttons. Read `README.md` first: it describes behaviour, configuration, the
file layout and the message protocol.

## Commands

```bash
make test            # host tests (C via cc, JavaScript via node --test)
make test-emulator   # end-to-end in the headless emulator against tools/fake_ha.js
pebble build         # the real build, without settings; output build/pebble-ha-glance.pbw
tools/emu.sh         # drive the emulator: install, click, send, shot, kill
make font            # regenerate resources/fonts/text.ffont
make icons           # render the launcher and appstore icons from their SVGs
```

After changing `messageKeys` or resources in `package.json`, run
`pebble clean` before building: the generated headers are only refreshed then.

## Rules

- **Never install a build with real settings into the emulator.** The
  phone-side script runs there too, and pressed buttons would act on the real
  house. `tools/emu.sh install` builds with `dev/settings.json` itself, and
  `tools/emu.sh install-unconfigured` without settings; use them instead of
  `pebble install --emulator`.
- The emulator must run headless: every `pebble` command that touches it
  needs `--emulator emery --vnc` (`tools/emu.sh` adds this).
- Settings are entered on the phone (`src/pkjs/settings.js`), never built
  in. Only `GLANCE_SETTINGS=<file> pebble build` writes a preset into
  `src/pkjs/preset.json`, which git ignores. A `settings.json` with a real
  token may still lie around: do not print or commit it.
- Code that needs no watch API (`layout`, `ink`, `fit`, `text`) is developed
  test-first with the host tests in `test/c`. `main.c` and `draw.c` are covered
  by the emulator test; after changing what the screen looks like, check
  `tools/emu.sh shot` by eye and then update the pictures in `test/screens`.
- `src/c/vendor` is third-party source, kept unmodified.
- The phone-side script is bundled by webpack 1, which predates current
  JavaScript syntax: keep to ES5 (`var`,
  `function`), no arrow functions or `const`.

## Pebble SDK documentation

https://developer.repebble.com, with an index of every page at
https://developer.repebble.com/llms.txt. Append `.md` to a documentation URL
for plain Markdown.
