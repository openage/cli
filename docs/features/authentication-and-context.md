# Authentication and context

Authentication establishes a remote session. Runtime context makes the current session and related tenant, application, organization, user, and role information available to service calls and commands.

## Architecture

Application initialization loads the configured application, host, and services. The authentication service first checks the cached session; if it is not active or cannot be used, it starts a login flow. Depending on application configuration, login uses stored or prompted credentials, or creates a session that the user activates through a browser.

The context service holds session and identity data and exposes it to request helpers. Service calls receive a context object so they can use the active tenant and session. The runtime cache is stored under `.cache`; it is local state, not a substitute for secure credential storage.

## Use cases

- Sign in when a command requires access to a protected service.
- Reuse an active session across commands in a workspace.
- Use `oa login` to initialize a session or `oa logout` to clear it.
- Inspect current identity and application values with `oa context`.

## Related features

- [Workspace and environments](./workspace-and-environments.md)
- [Configuration](./configuration.md)
- [API test specifications](./api-test-specifications.md)
