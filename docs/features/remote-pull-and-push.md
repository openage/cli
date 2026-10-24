# Remote pull and push

Pull and push move resource data between a remote HTTP service and local content files.

## Architecture

Input parsing resolves remote URI schemes (such as `get://`, `search://`, `create://`, and `update://`) and local `file://` or `folder://` locations into typed resources. The request helper dispatches reads to local file helpers or remote service operations, and dispatches writes to local files or remote create/update operations.

`oa pull` reads a remote record or search result, optionally applies transformations, resolves a local output path (which can be templated from the record and remote configuration), writes the data, and records its mapping. `oa push` finds selected local JSON files, reads each record, chooses an explicit target or the file's saved remote mapping, sends it, and updates metadata from the response.

Push processes files selected from the local path; it does not compare file contents against the remote or use Git status to decide whether to send a record.

## Use cases

- Pull one known record into a specific JSON file.
- Search a remote collection and save returned records into a local folder.
- Push a local JSON file to an explicit create or update target.
- Push a folder of local JSON files using each file's saved remote mapping.

## Related features

- [Local-to-remote metadata](./local-remote-metadata.md)
- [Transformations and templates](./transformations-and-templates.md)
- [Authentication and context](./authentication-and-context.md)
