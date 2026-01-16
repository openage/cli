import remote from '../helpers/remote.js'

export const directory = {
    tenants: remote('directory', 'tenants'),
    sessions: remote('directory', 'sessions'),
    roles: remote('directory', 'roles'),
    organizations: remote('directory', 'organizations')
}

export const config = {
    applications: remote('config', 'applications')
}
