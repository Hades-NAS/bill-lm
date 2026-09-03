import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { env } from '#/env'

type EncryptedSecret = { ciphertext: string; iv: string; authTag: string }
type SecretContext = {
  userId: string
  connectionId: string
  provider: string
  version: number
}

const aadFor = ({ userId, connectionId, provider, version }: SecretContext) =>
  `bill-lm:provider-connection:v1:${userId}:${connectionId}:${provider}:${version}`

function parseEncryptionKey(encoded: string | undefined) {
  if (!encoded) throw new Error('BYOK encryption is not configured')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('BYOK encryption is misconfigured')
  return key
}

function encryptWithKey(
  secret: string,
  context: SecretContext,
  key: Buffer,
): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aadFor(context)))
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ])
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

function decryptWithKey(
  encrypted: EncryptedSecret,
  context: SecretContext,
  key: Buffer,
) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encrypted.iv, 'base64'),
  )
  decipher.setAAD(Buffer.from(aadFor(context)))
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function createProviderSecretCipher(encodedKey: string) {
  const key = parseEncryptionKey(encodedKey)
  return {
    encrypt: (secret: string, context: SecretContext) =>
      encryptWithKey(secret, context, key),
    decrypt: (encrypted: EncryptedSecret, context: SecretContext) =>
      decryptWithKey(encrypted, context, key),
  }
}

export function encryptProviderSecret(
  secret: string,
  context: SecretContext,
): EncryptedSecret {
  return encryptWithKey(
    secret,
    context,
    parseEncryptionKey(env.BYOK_ENCRYPTION_KEY),
  )
}

export function decryptProviderSecret(
  encrypted: EncryptedSecret,
  context: SecretContext,
) {
  return decryptWithKey(
    encrypted,
    context,
    parseEncryptionKey(env.BYOK_ENCRYPTION_KEY),
  )
}
