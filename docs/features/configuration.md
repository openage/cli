# Configuration

Configuration stores persistent CLI settings such as the application host, active services, logger levels, and feature defaults.

## Architecture

The settings helper reads and writes JSON files under `.oa/settings/`. Settings can be addressed with dot-separated paths, for example `logger.level`. A default settings file is combined with the active environment's settings so environment values can override defaults.

The `oa config` handler gets or sets values. Values are stored as plain JSON unless the caller explicitly requests encryption with `--encrypt`. The encryption helper uses a generated workspace key in `.oa/secret.key`.

## Use cases

- Set the default log level with `oa config logger.level debug`.
- Configure `oa monit` polling independently with `oa config monit.pullIntervalMinutes 5` and `oa config monit.pushIntervalMinutes 5` (both default to five minutes).
- Keep different service or application settings for development and production.
- Encrypt a sensitive setting when storing it using `oa config <key> <value> --encrypt`.
- Inspect a setting without manually editing JSON.

## Related features

- [Workspace and environments](./workspace-and-environments.md)
- [Diagnostics and logging](./diagnostics-and-logging.md)
- [Workflow data](./workflow-data.md)
