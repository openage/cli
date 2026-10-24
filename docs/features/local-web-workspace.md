# Local web workspace

The local web workspace provides a browser-based view of selected workspace files and related CLI operations.

## Architecture

`oa serve` starts an HTTP server using the configured workspace folder and port. It serves the UI and exposes local APIs for directory/file access, resource metadata, CLI command execution, context/configuration, authentication, and Git operations.

The browser UI lets users browse content and specs, inspect metadata, open files in VS Code, and invoke common commands. Git status and diffs are read from Git commands; actions include staging, unstaging, reverting working-tree changes, and committing. File and directory responses include Git working-tree status, not remote sync status. The server checks requested paths against the workspace boundaries before accessing files.

Mapped JSON files open in a local/remote comparison viewer. Folder `index.json` metadata maps the folder to a service and collection; deeper folders add inherited `path-N` query values. Folder views refresh local and remote listings and show metadata-backed remote presence when the service is unavailable. File views support full-file pulls and pushes, remote-to-local line or hunk application, and save the exact pulled content as the latest merge base. Browser history restores folder and file selections.

## Use cases

- Browse local content and spec files without switching to a terminal.
- Inspect or edit a file and run pull, push, or test operations from its detail view.
- Review staged and unstaged Git diffs before committing.
- Open a workspace file directly in VS Code.
- Inspect a content file's remote metadata independently of its Git status.

## Related features

- [Local-to-remote metadata](./local-remote-metadata.md)
- [Schema validation](./schema-validation.md)
- [Diagnostics and logging](./diagnostics-and-logging.md)
