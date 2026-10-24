# Diagnostics and logging

Logging and diagnostic output help explain what the CLI is doing and where an operation failed.

## Architecture

The logger helper creates named logging channels and reads the default log level from settings, allowing more specific channel levels to override it. Command handlers use these channels to record execution details and errors. Operation logs are stored under `.logs`; the CLI also accepts log-level options for more detailed output.

Notification helpers display command results, errors, progress, and tabular test outcomes. Logs complement these user-facing notifications with operational detail.

## Use cases

- Increase logging detail for a failing command with a debug log level.
- Check `.logs` for request or handler details when diagnosing an issue.
- Use test summaries and validation tables to identify which response checks failed.

## Related features

- [Configuration](./configuration.md)
- [API test specifications](./api-test-specifications.md)
- [Local web workspace](./local-web-workspace.md)
