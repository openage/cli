export default [{
    'code': 'run',
    'title': 'Run',
    'handler': 'run',
    'config': {
        'fields': []
    }
},
{
    'code': 'remote',
    'title': 'Remote',
    'handler': 'remote',
    'config': {
        'fields': [
            {
                'code': 'l',
                'key': 'local',
                'label': 'Local',
                'type': 'text'
            },
            {
                'code': 'w',
                'key': 'cwd',
                'label': 'Working Directory',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'pull',
    'title': 'Pull',
    'handler': 'pull',
    'config': {
        'fields': [
            {
                'code': 'r',
                'key': 'remote',
                'label': 'Remote',
                'type': 'text'
            },
            {
                'code': 'w',
                'key': 'cwd',
                'label': 'Working Directory',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'push',
    'title': 'Push',
    'handler': 'push',
    'config': {
        'fields': [
            {
                'code': 'l',
                'key': 'local',
                'label': 'Local',
                'type': 'text'
            },
            {
                'code': 'w',
                'key': 'cwd',
                'label': 'Working Directory',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'test',
    'title': 'test',
    'handler': 'test',
    'config': {
        'fields': [
            {
                'code': 'f',
                'key': 'file',
                'label': 'File',
                'type': 'text'
            },
            {
                'code': 'w',
                'key': 'cwd',
                'label': 'Working Directory',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'script',
    'title': 'Script',
    'handler': 'script',
    'config': {
        'fields': [
            {
                'code': 'f',
                'key': 'file',
                'label': 'File',
                'type': 'text'
            },
            {
                'code': 'w',
                'key': 'cwd',
                'label': 'Working Directory',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'login',
    'title': 'Login',
    'handler': 'login',
    'config': {
        'fields': [
            {
                'code': 'e',
                'key': 'email',
                'label': 'Email',
                'type': 'text'
            },
            {
                'code': 'p',
                'key': 'password',
                'label': 'Password',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'config',
    'title': 'Config',
    'handler': 'config',
    'config': {
        'fields': []
    }
},
{
    'code': 'data',
    'title': 'Data',
    'handler': 'data',
    'config': {
        'fields': []
    }
},
{
    'code': 'logout',
    'title': 'Logout',
    'handler': 'logout',
    'config': {
        'fields': []
    }
},
{
    'code': 'serve',
    'title': 'Serve',
    'handler': 'serve',
    'config': {
        'fields': [
            {
                'code': 'f',
                'key': 'folder',
                'label': 'Folder',
                'type': 'text'
            },
            {
                'code': 'p',
                'key': 'port',
                'label': 'Port',
                'type': 'text'
            },
            {
                'code': 'f',
                'key': 'folder',
                'label': 'Folder',
                'type': 'text'
            }
        ]
    }
},
{
    'code': 'context',
    'title': 'Context',
    'handler': 'context',
    'config': {
        'fields': []
    }
},
{
    'code': 'quit',
    'title': 'Quit',
    'handler': 'quit',
    'config': {
        'fields': []
    }
},
{
    'code': 'init',
    'title': 'Init',
    'handler': 'init',
    'config': {
        'fields': []
    }
},
{
    'code': 'validate',
    'title': 'Validate',
    'handler': 'validate',
    'config': {
        'fields': [
            {
                'code': 'f',
                'key': 'file',
                'label': 'File',
                'type': 'string',
                'required': true
            }
        ]
    }
}]
