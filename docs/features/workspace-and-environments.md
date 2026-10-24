# Workspace and environments

Workspace selection determines which local files, settings, and runtime context a command uses. Environment selection lets a workspace keep environment-specific settings.

## Architecture

The workspace root is taken from `OA_CWD`, falling back to the process working directory. `--env` sets `NODE_ENV` before the application starts; the context service resolves the active environment from settings or the process environment.

The context path provider maps aliases such as `$cwd`, `$content`, `$specs`, `$scripts`, `$data`, `$oa`, `$meta`, `$settings`, and `$cache` to workspace paths. Handlers and shared helpers use these aliases to resolve inputs consistently.

## Use cases

- Run commands against a specific host and environment, for example `oa --host console.domain.com --env dev pull ...`.
- Point a process at a workspace by setting `OA_CWD`.
- Reference workspace locations using aliases in command inputs and configuration.
- Keep default settings separate from environment-specific settings.

## Related features

- [Configuration](./configuration.md)
- [Command runtime](./command-runtime.md)
