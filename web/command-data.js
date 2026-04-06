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
        name: 'context',
        title: 'context',
        overview: 'Inspect current runtime context values like session, user, role, tenant, and app.',
        keyConcepts: ['Runtime context', 'Dot-path lookup', 'Session inspection'],
        options: ['<path>', 'No flags required'],
        examples: ['oa context', 'oa context session', 'oa context session.token', 'oa context tenant.code', 'oa context user.profile.firstName']
    },
    {
        name: 'test',
        title: 'test',
        overview: 'Run API specification tests from `$specs` files or folders and view pass/fail results.',
        keyConcepts: ['Spec execution', 'Validation checks', 'Status reporting'],
        options: ['--cwd', '<spec code|file|folder>'],
        examples: ['oa test', 'oa test create-session', 'oa test $specs/sessions/create.json']
    },
    {
        name: 'init',
        title: 'init',
        overview: 'Initialize a new OA project directory with schemas, settings, and Git configuration.',
        keyConcepts: ['Project scaffolding', 'Git init', 'App creation'],
        options: ['--remote-origin', 'No flags required'],
        examples: ['oa init', 'oa init --remote-origin git@github.com:user/repo.git']
    },
    {
        name: 'validate',
        title: 'validate',
        overview: 'Validate JSON files against schemas with Draft 2020-12 support and dependency resolution.',
        keyConcepts: ['Schema validation', 'Draft 2020-12', '$ref Resolution'],
        options: ['--file', '<path>'],
        examples: ['oa validate ./data/system/applications/console.json', 'oa validate $content/navs/home.json']
    }
]
