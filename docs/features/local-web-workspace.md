# Local web workspace

The local web workspace provides a browser-based view of selected workspace files and related CLI operations.

## Architecture

`oa serve` starts an HTTP server using the configured workspace folder and port. It serves the UI and exposes local APIs for directory/file access, resource metadata, CLI command execution, context/configuration, authentication, and Git operations.

The browser UI has separate Data Explorer, Specs Explorer, and Assets Explorer roots. Explorer tabs reuse the current tab for a newly opened item; pinning keeps a tab open, the plus button creates a blank tab, and a tab-list menu provides access when many tabs are open without displacing the toolbar actions. The explorer toolbar shows the selected path at left and context-sensitive actions at right. The explorer pane can be hidden, and focus mode keeps the explorer tab bar available.

Data Explorer browses `$content`, Specs Explorer browses `$specs`, and Assets Explorer browses the workspace `assets/` directory. Assets are served from `/assets/<path>` and supported image files (SVG, PNG, JPEG, WebP, and ICO) render in an image preview with an option to open the source in a new tab. Unknown and non-image files remain available through the ordinary file view.

The browser UI lets users inspect metadata, open files in VS Code, and invoke common commands. Git status and diffs are read from Git commands; actions include staging, unstaging, reverting working-tree changes, and committing. File and directory responses include Git working-tree status, not remote sync status. The server checks requested paths against the workspace boundaries before accessing files.

Mapped JSON files open in a local/remote comparison viewer. Folder `index.json` metadata maps the folder to a service and collection; deeper folders add inherited `path-N` query values. Folder views refresh local and remote listings and show metadata-backed remote presence when the service is unavailable. File views support full-file pulls and pushes, remote-to-local line or hunk application, and save the exact pulled content as the latest merge base. Browser history restores folder and file selections.

Spec files use a syntax-highlighted editable JSON view, with save, validate, and test actions in the toolbar. The Last run panel shows the current spec's formatted result details. Specs folders summarize passing, failed, and not-yet-run files and can run the folder's tests. The summary scans nested folders concurrently; opening a large spec tree may still require multiple directory reads.

## Use cases

- Browse local content and spec files without switching to a terminal.
- Browse and preview static assets from the workspace `assets/` directory.
- Keep several files and folders open in tabs while preserving quick access to tab actions.
- Run one spec or a folder's specs and review structured pass/fail details.
- Inspect or edit a file and run pull, push, or test operations from its detail view.
- Review staged and unstaged Git diffs before committing.
- Open a workspace file directly in VS Code.
- Inspect a content file's remote metadata independently of its Git status.

## Related features

- [Local-to-remote metadata](./local-remote-metadata.md)
- [Schema validation](./schema-validation.md)
- [Diagnostics and logging](./diagnostics-and-logging.md)
