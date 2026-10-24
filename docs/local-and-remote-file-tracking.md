# Local and remote file tracking

The CLI keeps track of local-to-remote mappings and local Git changes separately. They answer different questions:

- **Remote metadata** records which remote resource a local content file corresponds to, so `oa pull` and `oa push` can find the matching resource.
- **Git status** records whether a file in the local repository is clean, staged, modified, or untracked. The web interface reads this from `git status --porcelain`.

## Remote metadata

Metadata is stored under `.oa/meta`, with folders corresponding to the local content folders under `data`. A record contains local resource information and remote identifiers such as the service, collection, query, and remote ID. It may contain mappings for multiple named remotes; commands use `origin` by default.

`oa pull` fetches data, writes it to the selected local path, and updates its metadata mapping. `oa push` reads the selected local JSON files, uses their mappings to determine remote targets (unless a target is explicitly supplied), sends the data, and updates the metadata.

This mapping does **not** compare local and remote file contents or determine whether a file has changed since the last sync. Push processes files selected from the local path; Git status is not used as a remote sync indicator.

## Git status

The web interface independently runs `git status --porcelain` for the workspace and displays each local file's working-tree state. It does not say whether that file has been pulled from or pushed to a remote service.
