# Workflow data

Workflow data provides small reusable values to CLI operations, especially inputs used by tests and scripts.

## Architecture

The data helper creates named stores backed by JSON files under `.data/<store>/`. The `input` store uses the active environment's JSON file, with a default file available for shared values. Keys support dot notation. When a value is explicitly encrypted, it is stored as an encrypted JSON object and decrypted by the helper when read.

The `oa data` command exposes get and set operations for a store and key. Test specifications can inject stored input values through template expressions such as `{{input.password}}`.

## Use cases

- Reuse a test user's email or other input across several API specifications.
- Set environment-specific inputs without duplicating test definitions.
- Store a sensitive workflow value with the encryption option.

## Related features

- [Configuration](./configuration.md)
- [API test specifications](./api-test-specifications.md)
- [Scripted workflows](./scripted-workflows.md)
