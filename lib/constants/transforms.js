export default [
    {
        'code': 'details',
        'type': 'service',
        'config': {
            'get': true
        }
    },
    {
        'code': 'remove',
        'type': 'modify',
        'config': {
            'remove': true
        }
    },
    {
        'code': 'remove-id',
        'type': 'modify',
        'config': {
            'remove': [
                'id'
            ]
        }
    }
]
