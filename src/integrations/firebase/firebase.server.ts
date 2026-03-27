import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { logger } from '#/integrations/logger.server'

import { env } from '#/env'

if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
  logger.error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')
  throw new Error(
    'GOOGLE_APPLICATION_CREDENTIALS environment variable is required to initialize Firebase Admin SDK',
  )
}

if (!admin.apps.length) {
  let serviceAccount: any
  try {
    serviceAccount = JSON.parse(readFileSync(resolve(env.GOOGLE_APPLICATION_CREDENTIALS), "utf-8"))

    logger.info(
      {
        type: serviceAccount.type,
        projectId: serviceAccount.project_id,
        hasPrivateKey: !!serviceAccount.private_key,
        privateKeyLength: serviceAccount.private_key?.length || 0,
      },
      'Initializing Firebase Admin SDK',
    )
  } catch (error) {
    logger.error({
      error,
      path: env.GOOGLE_APPLICATION_CREDENTIALS,
      message: error instanceof Error ? error.message : String(error),
    }, 'Failed to load Firebase credentials')
    throw error
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const isReady = Boolean(app.options.credential)

  if (isReady) {
    logger.info('Firebase Admin SDK initialized successfully')
  } else {
    logger.error('Failed to initialize Firebase Admin SDK')
    throw new Error('Firebase Admin SDK initialization failed')
  }
}

export const adminDb = admin.firestore()
export const adminAuth = admin.auth()
