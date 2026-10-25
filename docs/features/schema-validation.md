# Schema validation

Schema validation checks a local JSON file against a project schema.

## Architecture

The endpoint is resolved from the file remote metadata (`remote` or `remotes.origin`), falling back to the first two path components under `data/<service>/<collection>/`. The validator then loads `.oa/schemas/<service>.<collection>.schema.json`. Missing endpoint mappings or schemas fail validation with the expected schema path; there is no interactive schema index or per-file selector.

This command validates local files against the configured schema mapping; it is separate from the response field and schema checks supported by API test specifications.

## Use cases

- Check a content JSON file before pushing it to a remote service.
- Validate a file after editing it in the local web workspace or an editor.
- Validate mapped JSON files consistently before a full-file push or monitor queue operation.

## Related features

- [API test specifications](./api-test-specifications.md)
- [Local web workspace](./local-web-workspace.md)
- [Remote pull and push](./remote-pull-and-push.md)
