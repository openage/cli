import * as file from './file.js'
import crypto from 'crypto'

// ------------------------------------------------------
// Load or auto-generate machine-secret
// ------------------------------------------------------
function getMachineSecret() {
    const path = '$oa/secret.key'

    if (file.exists(path)) {
        return file.read(path)
    }

    // auto-generate new secret
    const newSecret = crypto.randomBytes(32).toString('base64')
    file.write(path, newSecret, { mode: 0o600, encoding: 'utf-8' }) // secure file permissions
    return newSecret
}

const machineSecret = getMachineSecret()

// ------------------------------------------------------
// Derive AES key from machine secret + salt
// ------------------------------------------------------
const deriveKey = (salt) => {
    return crypto.pbkdf2Sync(machineSecret, salt, 100000, 32, 'sha256')
}

// ------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------
export const encrypt = (value) => {
    value = `${value}`
    const iv = crypto.randomBytes(16)
    const salt = crypto.randomBytes(16)
    const key = deriveKey(salt)

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return {
        encrypted: true,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        data: encrypted
    }
}

export const decrypt = (enc) => {
    const salt = Buffer.from(enc.salt, 'hex')
    const iv = Buffer.from(enc.iv, 'hex')
    const key = deriveKey(salt)

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(enc.data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}
