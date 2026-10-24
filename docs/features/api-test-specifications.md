# API test specifications

API test specifications describe an HTTP request and the expected conditions on its response in JSON.

## Architecture

The test handler loads a single spec or discovers JSON specs in a folder, registers them, and runs them in sequence. Before sending the request, it finds template references and resolves values from runtime context, workflow input, user prompts, and previously captured responses.

The HTTP helper executes the request. Response data is stored so dependent tests can refer to earlier results. The validator runs field or schema checks; when the spec has no status validation, the runner adds a default expectation of HTTP 200. Test results and response output are controlled by CLI options and settings.

## Use cases

- Run a single endpoint check while developing an API.
- Run a folder of related API specs as a regression suite.
- Chain test cases by using a prior response in a later request.
- Prompt for a value at runtime while keeping it out of the spec file.
- Export or display request/response details to troubleshoot a failed test.

## Related features

- [Workflow data](./workflow-data.md)
- [Transformations and templates](./transformations-and-templates.md)
- [Authentication and context](./authentication-and-context.md)
- [Schema validation](./schema-validation.md)
