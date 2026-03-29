export const commands = [
    {
        name: 'pull',
        title: 'pull',
        overview: 'Pull content or configurations from remote sources into local workspace.',
        keyConcepts: ['Remote service', 'Data sync', 'Local storage'],
        options: ['--remote', '--cwd', '--list', '--filter'],
        examples: ['oa pull', 'oa pull --remote system://config', 'oa pull --cwd .']
    },
    {
        name: 'push',
        title: 'push',
        overview: 'Push local content to remote services with transformations and validations.',
        keyConcepts: ['Remote writes', 'Validation', 'Transformer'],
        options: ['--local', '--remote', '--cwd', '--schema'],
        examples: ['oa push', 'oa push --local ./data', 'oa push --remote system://target']
    },
    {
        name: 'script',
        title: 'script',
        overview: 'Execute scripted sequences of OA actions stored as JSON scripts.',
        keyConcepts: ['Batch operations', 'Command files', 'Condition handling'],
        options: ['--file', '--folder', '--cmd'],
        examples: ['oa script pull-system.json', 'oa script --file scripts/sync.json']
    },
    {
        name: 'serve',
        title: 'serve',
        overview: 'Host a local web portal for CLI docs and directory listing, with theme support.',
        keyConcepts: ['Local HTTP server', 'Static file serving', 'Config-driven options'],
        options: ['--port', '--folder'],
        examples: ['oa serve', 'oa serve --port 3002 --folder $cwd/web']
    },
    {
        name: 'config',
        title: 'config',
        overview: 'Manage CLI configuration values, e.g., logging and service endpoints.',
        keyConcepts: ['Persistent settings', '`.oa/settings`', 'env profiles'],
        options: ['--key', '--value', '--list', '--reset'],
        examples: ['oa config', 'oa config set serve.port 3000']
    },
    {
        name: 'test',
        title: 'test',
        overview: 'Run API specification tests from `$specs` files or folders and view pass/fail results.',
        keyConcepts: ['Spec execution', 'Validation checks', 'Status reporting'],
        options: ['--cwd', '<spec code|file|folder>'],
        examples: ['oa test', 'oa test create-session', 'oa test $specs/sessions/create.json']
    }
]
