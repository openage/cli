# Transformations and templates

Transformations reshape data; templates inject runtime values into resource paths, payloads, and test requests.

## Architecture

Pull accepts registered transformations and applies them sequentially through the request helper. A transformation identifies a resource type and operation, which are resolved to the corresponding transformer module.

The template helper uses Handlebars to interpolate objects or strings. It exposes helpers for text, date/time, number formatting and calculations, conditions, and common object/array lookups. Pull templates can use record data and remote configuration; tests can inject context, stored input, prompts, and prior response data.

## Use cases

- Remove or reshape fields before writing pulled data.
- Derive a local file path from a record's code or ID.
- Insert a stored input or prompted value into an API test request.
- Format or look up values while preparing request data.

## Related features

- [Remote pull and push](./remote-pull-and-push.md)
- [API test specifications](./api-test-specifications.md)
- [Workflow data](./workflow-data.md)
