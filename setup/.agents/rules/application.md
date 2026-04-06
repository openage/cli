---
trigger: always_on
description: Global configuration and guidelines for page design and testing based on settings in prod.json.
---

# Agent Rules: Application Design & Testing

## Context Configuration
The following configuration must be used for all page design and testing tasks. Use the `oa config [key]` command to retrieve current values.

- **Local Metadata Source (`pages.local`)**: Use `oa config pages.local`.
- **Application Metadata Source (`application.local`)**: Use `oa config application.local`.
- **Base Website URL (`pages.web`)**: Use `oa config pages.web`.

## Initialization Before Testing
Before starting any browser-based testing for pages, the agent must perform the following initialization steps to ensure local overrides are active:

1. **Set Initial Session URL**: Obtain the session token using `oa context session.token` and navigate to the base URL with it:
   `{{pages.web}}?session-token={{currentSession.token}}`
2. **Initialize Application Source**: Set the local override for application metadata:
   - Go to `{{pages.web}}/console/applications`
   - Set the Application Source to: `http://localhost:{{serve.port}}/%24content/system/applications`
3. **Initialize Page Source**: Set the local override for page metadata:
   - Go to `{{pages.web}}/console/pages`
   - Set the Web Location to: `http://localhost:{{serve.port}}/%24content/system/navs/{{application.code}}`


## Application Context & Metadata Inheritance
1. **Fallback Strategy**: The application's `meta.page` configuration (in `application.local`) serves as the base structure and default fallback for all project pages.
2. **Metadata Hierarchy**: When building or editing pages, the agent MUST:
   - Inherit default layouts, headers, footers, and templates from the application meta if they are missing or not explicitly overridden in the page's JSON.
   - Use the application's `meta.page.templates` as the source of truth for component rendering unless a page-specific template is provided.
3. **Validation**: All changes to the application metadata MUST be validated against `.oa/schemas/application.schema.json`.

## Design & Testing Guidelines
1. **Source of Truth**: When designing or updating pages, prioritize the JSON files located in the directory defined by `pages.local` (retrieve via `oa config pages.local`).
2. **Local Testing**: Always test UI changes against the URL defined by `pages.web` (retrieve via `oa config pages.web`) when applicable.
3. **Logging**: Every decision, design thinking, implementation plan, and change MUST be logged in `.agents/log.md`.
4. **Theme Management**: Page themes are located in `data/themes`. The theme URL is defined in `theme.style` within `application.local`. This CSS MUST be modified or utilized to fix and customize styles for the overall application or specific page sections.
5. **Environment Validation**: The pages can be tested only if the env tag is showing local.
6. **State Persistence**: If the agent session is interrupted, refer to `.agents/log.md` to restore the current context and progress.

## Aesthetics & Design System
Use the established design tokens in `prod.json` and follow the guidelines in the environment if any.
Maintain premium aesthetics with modern typography, gradients, and micro-animations as per the system instructions.

## Page Building & Component Enrichment
1. **API Spec Mapping**:
   - When requested to use a service, find the corresponding JSON spec in the `specs` folder.
   - Use the `code` and request details from the spec to define the data source.

2. **Data Source Configuration**:
   - Add data sources to `meta.data` in the page JSON.
   - For API services, use the following pattern:
     ```json
     {
       "code": "[resource-name]",
       "config": {
         "service": "[service-code]",
         "collection": "[collection-name]",
         "method": "[method-code]"
       }
     }
     ```
   - Ensure the `code` matches the reference used in UI components.

3. **Dynamic Components**:
   - Use `control: html` for data-driven lists.
   - The `value` property should be the code of the data source.
   - Use `options.template.code` (e.g., `"cards"`, `"summary"`) to define the look.
   - Use `options.class` for layout (e.g., `"cards flex-row four"`, `"flex-column"`).
   - Use `options.root` to define the base URL for navigation from the list items.

4. **Detailed Command Handling**:
   - Interpret commands like `"update [page] with [component] which shows [data] from [service]"` by:
     - Identifying the target page in the `pages.local` directory.
     - Registering the `data` source from `specs`.
     - Adding the section and component to the page's `meta.layout` and `meta.components`.
     - Setting up navigation links in `options.root`.

5. **Navigation Patterns**:
   - For "details of X in path/:id", ensure the list component has `options.root` set to the path prefix.
   - The detail page should be configured to accept parameters (e.g., `meta.params`).
