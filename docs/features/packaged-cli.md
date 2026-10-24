# Packaged CLI

The packaged CLI distributes OA CLI as a runnable binary so users do not need to invoke the JavaScript entry point directly.

## Architecture

The application starts from `index.js`, which initializes the command runtime, application configuration, and authentication. Build scripts package this Node.js application for supported operating systems. The package manifest also exposes the CLI entry point as the `oa` executable when installed through Node.js.

The build scripts and prerequisites are documented in the developer section of the [README](../../README.md). Build outputs are generated artifacts; the exact packaging process can depend on the platform and release setup.

## Use cases

- Install a prebuilt binary on a machine without a project checkout.
- Run the CLI through Node.js during development.
- Build a platform-specific binary for local testing or distribution.

## Related features

- [Command runtime](./command-runtime.md)
- [Workspace and environments](./workspace-and-environments.md)
