#
# This file is the default set of rules to compile a Pebble application.
#
# Feel free to customize this to your needs.
#
import json
import os
import os.path

top = '.'
out = 'build'


def options(ctx):
    ctx.load('pebble_sdk')


def configure(ctx):
    """
    This method is used to configure your build. ctx.load(`pebble_sdk`) automatically configures
    a build for each valid platform in `targetPlatforms`. Platform-specific configuration: add your
    change after calling ctx.load('pebble_sdk') and make sure to set the correct environment first.
    Universal configuration: add your change prior to calling ctx.load('pebble_sdk').
    """
    ctx.load('pebble_sdk')


def write_config(ctx):
    """
    Writes the configuration the phone side is built with: the settings plus the Home Assistant
    access token. Both are personal and kept out of git, in settings.json and ha-token.
    GLANCE_SETTINGS names another settings file, such as dev/settings.json, which brings a token
    of its own.
    """
    settings_path = os.environ.get('GLANCE_SETTINGS', 'settings.json')
    settings = ctx.path.find_node(settings_path)
    if settings is None:
        ctx.fatal('{} is missing: copy settings.example.json to it and adjust it'.format(settings_path))
    config = json.loads(settings.read())
    if 'token' not in config:
        token = ctx.path.find_node('ha-token')
        if token is None or not token.read().strip():
            ctx.fatal('ha-token is missing: put a Home Assistant long-lived access token into that file')
        config['token'] = token.read().strip()
    ctx.path.make_node('src/pkjs/config.json').write(json.dumps(config, indent=2))


def build(ctx):
    ctx.load('pebble_sdk')
    if ctx.cmd == 'build':
        write_config(ctx)

    build_worker = os.path.exists('worker_src')
    binaries = []

    cached_env = ctx.env
    for platform in ctx.env.TARGET_PLATFORMS:
        ctx.env = ctx.all_envs[platform]
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf = '{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_build(source=ctx.path.ant_glob('src/c/**/*.c'), target=app_elf, bin_type='app',
                      includes=['src/c/vendor'])

        if build_worker:
            worker_elf = '{}/pebble-worker.elf'.format(ctx.env.BUILD_DIR)
            binaries.append({'platform': platform, 'app_elf': app_elf, 'worker_elf': worker_elf})
            ctx.pbl_build(source=ctx.path.ant_glob('worker_src/c/**/*.c'),
                          target=worker_elf,
                          bin_type='worker')
        else:
            binaries.append({'platform': platform, 'app_elf': app_elf})
    ctx.env = cached_env

    ctx.set_group('bundle')
    ctx.pbl_bundle(binaries=binaries,
                   js=ctx.path.ant_glob(['src/pkjs/**/*.js',
                                         'src/pkjs/**/*.json',
                                         'src/common/**/*.js']),
                   js_entry_file='src/pkjs/index.js')
