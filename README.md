# OA Command Line Interface

A command-line tool for managing workspace resources with support for pulling, pushing, testing, and scripting operations against remote services.

## Installation

### Packaged Binary (Recommended)
If a packaged binary is available for your platform:
- **Windows**: Download `oa.exe` and place it in a folder included in your `PATH` (e.g., `C:\Windows\System32` or a custom folder).
- **Unix/Linux/macOS**: Download the `oa` binary, place it in `/usr/local/bin`, and make it executable with `chmod +x oa`.

### Via Node.js (Development)
If you have Node.js installed:
```bash
# Clone or download the project
npm install
node index.js --help
```

## Getting Started

### First-Time Setup
1. Set your host and environment:
   ```bash
   oa --host console.domain.com --env prod
   ```
   These can also be passed as global options with any command.

2. The CLI will prompt for authentication when needed. Session tokens are cached securely in `.oa/cache`.

### Workspace Structure
The CLI uses the following folder structure in your workspace:
- `.cache` - Encrypted session cache
- `.oa/settings.json` - CLI configuration (with environment-specific overrides like `.oa/settings.dev.json`)
- `.oa/meta` - Per-folder remote metadata for mapping local to remote resources
- `.logs` - Operation logs
- `data` - Data folders (e.g., `data/system/navs`)
- `specs` - Test specification files
- `scripts` - Custom operation scripts

To sync a folder with a remote service, add a `.oa/remote.json` file describing the remote source.

## Commands Overview

- `oa pull <source?> <target?>` - Fetch data from remote to local
- `oa push <source?> <target?>` - Send local data to remote
- `oa test <spec-or-folder>` - Run JSON-based test specifications
- `oa config [key] [value]` - View or manage configuration
- `oa data <store/key?> [value?]` - Manage data stores for test inputs/outputs
- `oa script <path>` - Execute custom scripts
- `oa login` / `oa logout` - Manage authentication

Use `--help` with any command for detailed options:
```bash
oa pull --help
```

## Configuration

Manage CLI settings stored in `.oa/settings.json`.

```bash
# View all settings
oa config

# View a specific setting
oa config logger.level

# Set a value
oa config logger.level debug

# Set and encrypt a sensitive value
oa config credentials.password mysecret --encrypt
```

Settings support dot-notation for nested properties and environment-specific overrides.

## Data Management

Store and retrieve small data values for workflows, useful for test inputs and temporary data.

```bash
# View all data in a store
oa data input

# View a specific key
oa data input:user.email

# Set a value
oa data input:user.email admin@example.com

# Set and encrypt a sensitive value
oa data input:credentials.password mysecret --encrypt
```

Data is stored in `.data/<store>/<env>.json` (e.g., `.data/input/default.json`) with environment-specific overrides.

## Pulling Data

Fetch data from remote services to local files.

### Single Item
```bash
# Using metadata in the same folder
oa pull system/navs/home.json

# Explicit source
oa pull get://system/navs/home?application-code=docs system/navs/docs/home.json
```

### Bulk/Folder Pull
```bash
# Using .oa/remote.json in the folder
oa pull docs-nav

# Explicit source
oa pull search://system/navs?application-code=docs docs-nav
```

Supported URI schemes:
- `get://service/collection/id?params` - Single item
- `search://service/collection?params` - List of items
- `folder://path/to/folder` - Local folder
- `file://path/to/file.json` - Local file

For bulk pulls, create a `.oa/meta/system/navs/remote.json`:
```json
{
  "service": "system",
  "collection": "navs",
  "query": { "application-code": "docs" }
}
```

## Pushing Data

Send local data to remote services.

### Single File
```bash
# Using metadata
oa push system/navs/home.json

# Explicit target
oa push system/navs/home.json update://system/navs/home?application-code=docs
```

### Bulk Push
```bash
oa push system/navs
```

Use `create://` for new items, `update://` for existing ones.

## Remote Metadata

Manage remote metadata mappings for local files, enabling push/pull operations to track which files correspond to which remote resources.

### Create or Update Remote Metadata
```bash
# Map a local file to a remote resource
oa remote ./data/system/navs/home.json https://system/navs/home?application=www-applegos

# Or get the mapped remote for the local file
oa remote ./data/system/navs/home.json
```

This command shows the mapped remote

```yaml
remote.type: "http"
remote.config.service: "system"
remote.config.collection: "navs"
remote.config.query.application: "www-applegos"
remote.config.id: "home"
```

The remote command stores metadata in `.oa/meta/`, creating a mapping that includes:
- Local file information (path, id, code)
- Remote resource information (service, collection, query parameters)
- Resource metadata (name, summary, timestamp)

This metadata is used by push and pull operations to maintain the relationship between local files and their remote counterparts, enabling smart sync operations.

## Testing

Run JSON-based test specifications with request/response validation.

```bash
# Single spec
oa test specs/directory/sessions/create.json

# All specs in folder
oa test specs/directory
```

Options:
- `--show-response` - Display raw request/response
- `--export-curl` - Show equivalent cURL command

Example spec:
```json
{
  "name": "Create Session",
  "request": {
    "method": "POST",
    "url": "{{context.tenant.services.directory.url}}/sessions",
    "headers": { "Content-Type": "application/json" },
    "body": {
      "user": { "email": "{{prompt.email}}" },
      "credentials": { "password": "{{input.password}}" }
    }
  },
  "validations": [
    { "field": "status", "value": 200 },
    { "field": "duration", "operator": "<", "value": 1000 }
  ]
}
```

The prompt supports two formats:
1. Full Format: `[type] key=defaultValue: Message`; example - `{{prompt.[text] firestName: First Name}}`
2. Shorthand: `email`, `password` (maps to predefined constants); ; example - `{{prompt.password}}`

## Scripting

Execute sequences of operations defined in JSON scripts.

```bash
oa script scripts/bulk.json
```

Example script:
```json
{
  "items": [
    { "type": "pull", "config": { "remote": "search://system/applications" } },
    { "type": "push", "config": { "source": "data/system/navs" } }
  ]
}
```

## Troubleshooting

- **Debug logging**: Add `--log-level debug` to commands
- **Check logs**: Review `.logs/` for detailed request/response records
- **Authentication issues**: Re-run the command to re-authenticate, or clear `.oa/cache`
- **URI confusion**: Use `file://` or `folder://` for local paths, `get://` or `search://` for remote
- **Configuration**: Edit `.oa/settings.json` directly or use `oa config`

## Examples

```bash
# Set environment
oa --host console.domain.com --env dev

# Pull data
oa pull system/navs/home.json
oa pull ./data/system/navs https://system/navs --transforms remove:obj://id,timeStamp

# Push changes
oa push system/navs/home.json

# Run tests
oa test specs/directory --show-response

# Configure settings
oa config logger.level debug

# Manage data
oa data test/input:user.email admin@example.com

# Run a script
oa script scripts/bulk.json
```

## Build (For Developers)

Prerequisites: Node.js 16+, `pkg`, `resedit`

```bash
npm install -g pkg resedit
node scripts/build-win.mjs --platform win --architecture x64  # Windows
node scripts/build-win.mjs --platform all                     # All platforms
```

Outputs to `../../builds/`.

