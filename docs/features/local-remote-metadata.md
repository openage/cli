# Local-to-remote metadata

Remote metadata records the relationship between a local content resource and one or more remote resources. It helps the CLI resolve the destination or source for pull and push operations; it is not a local change detector.

## Architecture

The file helper stores metadata under `.oa/meta/`, mirroring the local content folder path. Metadata records can include the local ID, code, name, summary, timestamp, and remote service, collection, query, and resource ID.

`oa remote` creates or displays a mapping. `oa pull` updates the mapping after writing a remote result locally; `oa push` updates it after sending local data to a remote. Multiple named remote mappings are kept in the `remotes` property, and the CLI defaults to `origin`. Older single-remote metadata is also read for compatibility.

Git status is separate: it describes changes in the local repository and is not the remote sync state. The mapping does not contain a content hash or compare remote and local file contents.

## Use cases

- Associate a local JSON file with the remote record it represents.
- Pull or push a file later without repeating the full remote URI.
- Maintain separate mappings when working with multiple named remotes.
- Inspect a mapping when diagnosing which remote resource a local file targets.

## Related features

- [Remote pull and push](./remote-pull-and-push.md)
- [Local web workspace](./local-web-workspace.md)
- [Local and remote file tracking](../local-and-remote-file-tracking.md)
