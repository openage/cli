# OA CLI Changelog

Notable changes to the OA CLI are recorded here.


## [2.5.0] - 2026-10-24

### Added

- Added a two-pane local/remote JSON comparison viewer with syntax highlighting, aligned changes, inline differences, keyboard navigation, and whitespace filtering.
- Added folder comparison with `index.json` remote mappings, inherited path queries, and local/remote file presence indicators.
- Added folder file creation and remote-to-local line or hunk application in the web viewer.
- Added remote pull snapshots to file metadata for future three-way merges.
- Added focus mode, sidebar tabs, and sidebar visibility controls to file comparison.

### Changed

- Limited remote publishing in the web viewer to the full local file; remote pulls replace the full local file.
- Added browser Back and Forward navigation for folder and file views.

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
