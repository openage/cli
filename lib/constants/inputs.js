export default [
    {
        'code': 'run',
        'type': 'text',
        'name': 'run',
        'message': 'Command'
    },
    {
        'code': 'host',
        'type': 'text',
        'name': 'host',
        'message': 'Application'
    },
    {
        'code': 'system-service',
        'type': 'text',
        'name': 'service',
        'message': 'Application Provider'
    },
    {
        'code': 'auth-service',
        'type': 'text',
        'name': 'service',
        'message': 'Authentication Provider'
    },
    {
        'code': 'tenant-code',
        'type': 'text',
        'name': 'Tenant Code',
        'message': 'Tenant Code'
    },
    {
        'code': 'env',
        'type': 'list',
        'name': 'env',
        'message': 'Environment',
        'choices': [
            { name: 'Development', value: 'dev' },
            { name: 'Testing', value: 'qa' },
            { name: 'Acceptance', value: 'uat' },
            { name: 'Staging', value: 'stage' },
            { name: 'Production', value: 'prod' }
        ]
    },
    {
        'code': 'cmd',
        'type': 'commands',
        'name': 'cmd',
        'message': 'Select a command'
    },
    {
        'code': 'clean',
        'type': 'confirm',
        'name': 'clean',
        'message': 'Clean the session?'
    },
    {
        'code': 'quit',
        'type': 'confirm',
        'name': 'quit',
        'message': 'Close the session?'
    },
    {
        'code': 'email',
        'type': 'email',
        'name': 'email',
        'message': 'Enter Email'
    },
    {
        'code': 'password',
        'type': 'password',
        'name': 'password',
        'message': 'Enter Password'
    },
    {
        'code': 'otp',
        'type': 'password',
        'name': 'otp',
        'message': 'Enter OTP'
    },
    {
        'code': 'script',
        'type': 'file',
        'name': 'script',
        'message': 'Please select the script file'
    },
    {
        'code': 'file',
        'type': 'file',
        'name': 'file',
        'message': 'Please select a file'
    },
    {
        'code': 'cwd',
        'type': 'directory',
        'name': 'cwd',
        'message': 'Please select a folder'
    },
    {
        'code': '',
        'type': 'directory',
        'name': 'folder',
        'message': 'Please select a folder'
    },
    {
        'code': 'source',
        'type': 'placeholder',
        'name': 'source',
        'message': 'Source',
        'format': {
            'type': '{{data.endpoint.type}}',
            'config': {
                'service': '{{data.service}}',
                'collection': '{{data.endpoint.collection}}',
                'id': '{{data.endpoint.id}}'
            }
        }
    },
    {
        'code': 'target',
        'type': 'text',
        'name': 'target',
        'message': 'Target'
    },
    {
        'code': 'application-code',
        'type': 'text',
        'name': 'code',
        'message': 'Application Code'
    },
    {
        'code': 'application-name',
        'type': 'text',
        'name': 'name',
        'message': 'Application Name'
    },
    {
        'code': 'application-title',
        'type': 'text',
        'name': 'title',
        'message': 'Application Title'
    },
    {
        'code': 'ux.theme.code',
        'type': 'list',
        'name': 'code',
        'message': 'Theme',
        'choices': [
            { 'name': 'One Dark Pro', 'value': 'one-dark-pro' },
            { 'name': 'GitHub Theme', 'value': 'github' },
            { 'name': 'Night Owl', 'value': 'night-owl' }
        ]
    },
    {
        'code': 'ux.theme.name',
        'type': 'text',
        'name': 'name',
        'message': 'Theme Name'
    },
    {
        'code': 'ux.theme.mode',
        'type': 'list',
        'name': 'mode',
        'message': 'Mode',
        'choices': [
            { 'name': 'Dark', 'value': 'dark' },
            { 'name': 'Light', 'value': 'light' },
            { 'name': 'System Default', 'value': 'system' }
        ]
    },
    {
        'code': 'ux.progress.view',
        'type': 'list',
        'name': 'view',
        'message': 'Progres View',
        'choices': [
            { 'name': 'Bar', 'value': 'bar' },
            { 'name': 'Spinner', 'value': 'spinner' },
            { 'name': 'Hidden', 'value': 'hidden' }
        ]
    },
    {
        'code': 'ux.progress.position',
        'type': 'list',
        'name': 'position',
        'message': 'ProgressPosition',
        'choices': [
            { 'name': 'Top', 'value': 'top' },
            { 'name': 'Center', 'value': 'center' },
            { 'name': 'Bottom', 'value': 'bottom' }
        ]
    },
    {
        'code': 'ux.progress.details',
        'type': 'confirm',
        'name': 'details',
        'message': 'Progress Details'
    },
    {
        'code': 'ux.progress.duration',
        'type': 'number',
        'name': 'duration',
        'message': 'Progress Hide Delay (ms)'
    },
    {
        'code': 'create-confirm',
        'type': 'confirm',
        'name': 'confirm',
        'message': 'The application was not found. Would you like to create it?'
    },
    {
        'code': 'local',
        'type': 'placeholder',
        'name': 'local',
        'format': {
            'type': '{{data.type}}',
            'config': {
                'file': '{{data.file}}',
                'folder': '{{data.folder}}'
            }
        },
        'next': [
            {
                'code': 'local-source',
                'type': 'list',
                'name': 'type',
                'message': 'What to pull',
                'choices': [
                    {
                        'name': 'File',
                        'value': 'file',
                        'next': [
                            {
                                'code': 'file',
                                'type': 'file',
                                'name': 'file',
                                'message': 'File'
                            }
                        ]
                    },
                    {
                        'name': 'Collection',
                        'value': 'folder',
                        'next': [
                            {
                                'code': 'folder',
                                'type': 'directory',
                                'name': 'folder',
                                'message': 'Folder'
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        'code': 'remote',
        'type': 'placeholder',
        'name': 'remote',
        'format': {
            'type': '{{data.endpoint.type}}',
            'config': {
                'service': '{{data.service}}',
                'collection': '{{data.endpoint.collection}}',
                'id': '{{data.id}}'
            }
        },
        'next': [
            {
                'code': 'service',
                'type': 'services',
                'name': 'service',
                'message': 'Service'
            },
            {
                'code': 'endpoint',
                'type': 'endpoints',
                'name': 'endpoint',
                'message': 'Endpoint',
                'next': [
                    {
                        'code': 'id',
                        'condition': [
                            {
                                'key': 'endpoint.type',
                                'operator': '===',
                                'value': 'get'
                            },
                            {
                                'key': 'id',
                                'operator': '!exists'
                            }
                        ],
                        'type': 'text',
                        'name': 'id',
                        'message': 'Id'
                    }
                ]
            }
        ]
    },
    {
        'code': 'logger.level',
        'type': 'list',
        'name': 'logger.level',
        'message': 'Logger Level',
        'choices': [
            { name: 'Fatal', value: 'fatal' },
            { name: 'Error', value: 'error' },
            { name: 'Warn', value: 'warn' },
            { name: 'Info', value: 'info' },
            { name: 'Debug', value: 'debug' },
            { name: 'Trace', value: 'trace' },
            { name: 'Silly', value: 'silly' }
        ]
    },
    {
        'code': 'ux.terminal.mode',
        'type': 'list',
        'name': 'ux.terminal.mode',
        'message': 'Terminal Mode',
        'choices': [
            { name: 'Collapsed', value: 'collapsed' },
            { name: 'Expanded', value: 'expanded' }
        ]
    },
    {
        'code': 'ux.mode',
        'type': 'list',
        'name': 'ux.mode',
        'message': 'UX Mode',
        'choices': [
            { name: 'CLI', value: 'cli' },
            { name: 'Web', value: 'web' }
        ]
    },
    {
        'code': 'ux.interactive',
        'type': 'confirm',
        'name': 'ux.interactive',
        'message': 'Interactive Mode'
    },
    {
        'code': 'serve.folder',
        'type': 'text',
        'name': 'serve.folder',
        'message': 'Serve Folder'
    },
    {
        'code': 'serve.port',
        'type': 'number',
        'name': 'serve.port',
        'message': 'Serve Port'
    },
    {
        'code': 'proceed',
        'type': 'confirm',
        'name': 'proceed',
        'message': 'Do you want to proceed with these initialization steps?'
    },
    {
        'code': 'remote-origin',
        'type': 'text',
        'name': 'remoteOrigin',
        'message': 'Enter Git remote origin URL (optional, leave empty to skip):'
    }
]
