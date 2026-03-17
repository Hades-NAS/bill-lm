import admin from 'firebase-admin'

import { env } from '#/env'
import { logger } from '#/integrations/logger.server'

if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
  logger.error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')
  throw new Error(
    'GOOGLE_APPLICATION_CREDENTIALS environment variable is required to initialize Firebase Admin SDK',
  )
}

if (!admin.apps.length) {
  const serviceAccount = require(env.GOOGLE_APPLICATION_CREDENTIALS)

  logger.info('Initializing Firebase Admin SDK')

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
