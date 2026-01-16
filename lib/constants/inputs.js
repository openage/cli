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
        'message': 'Email'
    },
    {
        'code': 'password',
        'type': 'password',
        'name': 'password',
        'message': 'Password'
    },
    {
        'code': 'session-activation-code',
        'type': 'password',
        'name': 'code',
        'message': 'Activation Code'
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
    }
]
