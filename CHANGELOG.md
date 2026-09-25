# OA CLI Changelog

Notable changes to the OA CLI are recorded here.


## [2.4.0] - 2026-09-22

### Added

- Added web theme presets, light/dark/system modes, and configurable accent colors.
- Added JSON file pinning and a pinned-files view in the web interface.
- Added web session renewal support.
- Added named remote configurations for `oa pull` and `oa push`.

### Changed

- Updated pull and push metadata to support multiple named remotes while continuing to read legacy single-remote metadata as `origin`.
- Refreshed the web interface styling and theme configuration experience.

### Fixed

- Improved notification error output to include stack traces and nested causes.
- Improved test request failure handling by logging and notifying errors while retaining available response details and data.