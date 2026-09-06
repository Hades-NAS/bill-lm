import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getServiceLogger } from '#/integrations/logger.server'

import { env } from '#/env'

const logger = getServiceLogger('FirebaseIntegration')

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app()
  }

  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    logger.error(
      'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set',
    )
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS environment variable is required to initialize Firebase Admin SDK',
    )
  }

  let serviceAccount: any
  try {
    logger.info('Loading Firebase credentials from file', {
      path: env.GOOGLE_APPLICATION_CREDENTIALS,
    })
    serviceAccount = JSON.parse(
      readFileSync(resolve(env.GOOGLE_APPLICATION_CREDENTIALS), 'utf-8'),
    )

    logger.info('Initializing Firebase Admin SDK', {
      type: serviceAccount.type,
      projectId: serviceAccount.project_id,
      hasPrivateKey: !!serviceAccount.private_key,
      privateKeyLength: serviceAccount.private_key?.length || 0,
    })
  } catch (error) {
    logger.error('Failed to load Firebase credentials', {
      error,
      path: env.GOOGLE_APPLICATION_CREDENTIALS,
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  if (!app.options.credential) {
    logger.error('Failed to initialize Firebase Admin SDK')
    throw new Error('Firebase Admin SDK initialization failed')
  }

  logger.info('Firebase Admin SDK initialized successfully')
  return app
}

function createLazyFirebaseService<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const service = factory()
      const value = Reflect.get(service, property, service)
      return typeof value === 'function' ? value.bind(service) : value
    },
  })
}

// Route modules may import Firebase Admin during application bootstrap. Delay
// credential-file access until a server operation actually needs the service.
export const adminDb = createLazyFirebaseService(() =>
  getAdminApp().firestore(),
)
export const adminAuth = createLazyFirebaseService(() => getAdminApp().auth())
