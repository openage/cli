# OA CLI features

This is the feature index for the OA CLI. Each page focuses on one feature and explains its architecture and practical use cases. For command syntax and quick-start instructions, see the [README](../README.md).

| Feature | Description |
| --- | --- |
| [Command runtime](./features/command-runtime.md) | How commands are parsed and routed to handlers. |
| [Workspace and environments](./features/workspace-and-environments.md) | How the working directory, environment, and path aliases are selected. |
| [Authentication and context](./features/authentication-and-context.md) | How sessions are created and application context is made available to requests. |
| [Configuration](./features/configuration.md) | How persistent settings, environment overrides, and encrypted values work. |
| [Workflow data](./features/workflow-data.md) | How named JSON stores supply reusable workflow values. |
| [Remote pull and push](./features/remote-pull-and-push.md) | How records move between HTTP services and local content files. |
| [Monit](./features/monit.md) | Poll mapped JSON files, validate queued pushes, pull safe remote changes, and review conflicts. |
| [Local-to-remote metadata](./features/local-remote-metadata.md) | How local content paths are mapped to remote resources. |
| [Transformations and templates](./features/transformations-and-templates.md) | How data is transformed and dynamic values are injected. |
| [API test specifications](./features/api-test-specifications.md) | How JSON specs issue requests and validate responses. |
| [Scripted workflows](./features/scripted-workflows.md) | How a JSON file runs a sequence of CLI operations. |
| [Schema validation](./features/schema-validation.md) | How local JSON files are checked against project schemas. |
| [Local web workspace](./features/local-web-workspace.md) | Data, Specs, and Assets Explorers, tabs, image previews, file comparison, spec test results, metadata, CLI operations, and Git tools. |
| [Diagnostics and logging](./features/diagnostics-and-logging.md) | How logging levels and operation logs support troubleshooting. |
| [Packaged CLI](./features/packaged-cli.md) | How the Node.js application is built into platform binaries. |

## Workspace data locations

The features use these workspace locations:

| Location | Purpose |
| --- | --- |
| `.oa/settings/` | Default and environment-specific CLI settings |
| `.oa/meta/` | Local-to-remote mappings and related resource metadata |
| `.oa/secret.key` | Local key material used when settings or workflow data are explicitly encrypted |
| `.cache/` | Runtime cache, including session context and test state |
| `.data/` | Workflow data stores |
| `data/` | Local content files used by pull and push |
| `specs/` | JSON API test specifications |
| `scripts/` | JSON command sequences |
| `.logs/` | Operation logs |

Settings and workflow values are encrypted only when explicitly written with the encryption option. Session context in `.cache` is runtime state and should not be assumed to be encrypted.
