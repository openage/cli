# Command runtime

The command runtime turns a command name and its arguments into an invocation of a feature handler.

## Architecture

The command catalog in `lib/constants/actions.js` associates command names with handler modules and supported options. `src/services/command.js` builds the Yargs command interface, parses options and positional arguments, and dynamically imports the selected module from `lib/handlers/`. Each handler owns the command-specific behavior and may provide a parser for its positional arguments.

At startup, `index.js` initializes the application and authentication. If a command was provided, the runtime dispatches it; otherwise it enters the configured interactive loop.

## Use cases

- Run a one-off operation such as `oa pull ...` from a terminal or automation script.
- Use `oa --help` or a command's help output to inspect available options.
- Use the interactive mode when no command is supplied and the workspace is configured for interaction.

## Related features

- [Workspace and environments](./workspace-and-environments.md)
- [Authentication and context](./authentication-and-context.md)
- [Scripted workflows](./scripted-workflows.md)
