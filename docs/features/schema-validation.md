# Schema validation

Schema validation checks a local JSON file against a project schema.

## Architecture

The validate handler resolves the requested file and reads the schema index at `.oa/schemas/index.json`. It compares the target file's parent folder with folder entries in the index to find the associated schema. If there is no folder mapping, it can prompt the user to choose from schemas listed in the index.

This command validates local files against the configured schema mapping; it is separate from the response field and schema checks supported by API test specifications.

## Use cases

- Check a content JSON file before pushing it to a remote service.
- Validate a file after editing it in the local web workspace or an editor.
- Select a schema interactively for a folder that has no explicit schema mapping.

## Related features

- [API test specifications](./api-test-specifications.md)
- [Local web workspace](./local-web-workspace.md)
- [Remote pull and push](./remote-pull-and-push.md)
