# Evolution Log: Applegos Design & Testing

## [2026-03-29] Testing Rule Update
- **Change**: Added a new rule to `rules.md` requiring the `env` tag to show `local` for page testing.
- **Rationale**: Ensure testing only happens in the appropriate environment context as requested by the user.

## [2026-04-03] Page Building & Component Enrichment Rules
- **Change**: Added detailed instructions for mapping API specs from the `specs` folder to page metadata and UI components.
- **Rationale**: The user wants the agent to handle high-level commands like "update home page with list cards which shows list of profiles from the discovery service".
- **Details**:
    - Mapped `specs/` folder as a source for API details.
    - Standardized `meta.data` configuration for service providers.
    - Defined navigation patterns using `options.root`.
    - Added UI component template rules (cards, summary etc.).

## [2026-04-06] Home Page Layout Fix
- **Change**: Refactoring `home.json` to improve visual layout, align with schema version 2.0, and modernize hero section.
- **Rationale**: The user wants to fix the layout which was inconsistent and had components separated from their sections. Schema alignment ensures correctness for the renderer.
- **Tasks**:
    - **Standardize Sections**: Move `title`, `description`, and `link` under `container.header`.
    - **Modernize Hero**: Refactor `hero-feature-section` with better flex layout and premium classes.
    - **Component Consolidation**: Move components from `meta.components` into their respective sections in `meta.layout.sections`.
    - **Spacing and Flow**: Reorder sections for better storytelling (Hero -> Features -> Overview -> Benefits -> Services -> Scores -> Use Cases -> Domains -> Contact/Footer).
    - **Data Alignment**: Ensure `control: "html"` components use `options.template.code` as per rule.

## [2026-04-06] Initialization Before Testing Rules
- **Change**: Added a new section `## Initialization Before Testing` to `application.md`.
- **Rationale**: The user wants to ensure the agent correctly initializes the pages and application metadata sources before performing browser-based tests.
- **Details**:
    - **Step 1**: Set the session token in the URL: `{{pages.web}}?session-token={{currentSession.token}}`.
    - **Step 2**: Initialize Application Source in `/console/applications` to: `http://localhost:{{serve.port}}/%24content/system/applications`.
    - **Step 3**: Initialize Page Source in `/console/pages` to: `http://localhost:{{serve.port}}/%24content/system/navs/{{application.code}}`.

## [2026-04-06] Home Session Token Context Alignment
- **Change**: Updated API specs used by homepage/discovery flows to resolve `x-access-token` from `{{context.session.token}}`.
- **Rationale**: Ensure token retrieval is sourced from `oa context session.token` and avoid brittle response-chain dependencies.
- **Details**:
    - Replaced `{{response.directory.sessions.current.token}}` with `{{context.session.token}}` across discovery/directory specs.
    - Corrected typoed token path `{{response.directory-session-current.token}}` to `{{context.session.token}}`.
    - Validated modified JSON files still parse successfully.

## [2026-04-06] home.json Test Run
- **Change**: Executed structural and runtime-reference checks for `data/system/navs/www-applegos/home.json`.
- **Rationale**: Validate homepage metadata safety and identify blockers for local rendering.
- **Result**:
    - JSON parsing passed.
    - Schema root alignment (`meta`) and required layout structure checks passed.
    - Found unresolved route target: `/home/benefits` (no matching nav page).
    - Found local asset source gaps for `/assets/app/applegos/data/{services,features,use-cases,benefits,pricing}.json` in this workspace.
