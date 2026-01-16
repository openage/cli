export default [{
    'code': 'run',
    'title': 'Run',
    'handler': 'run'
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
    'handler': 'logout'
},
{
    'code': 'quit',
    'title': 'Quit',
    'handler': 'quit'
}]
