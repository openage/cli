# Scripted workflows

Scripted workflows execute a sequence of CLI operations declared in a JSON file.

## Architecture

The script handler resolves the requested JSON path, including files under the workspace `scripts` directory. It reads either an `items` array or a single command object, filters out entries marked `disabled`, and looks up each item's handler in the command catalog. Items run sequentially, and progress is reported as each completes.

Each item provides a command `type` and its handler-specific `config`. The script runner invokes the same handlers used by direct CLI commands.

## Use cases

- Repeat a known pull-then-push sequence during setup or release preparation.
- Run a batch of operations with one `oa script` command.
- Keep optional steps in a script and disable them without deleting the configuration.

## Related features

- [Command runtime](./command-runtime.md)
- [Remote pull and push](./remote-pull-and-push.md)
- [API test specifications](./api-test-specifications.md)
