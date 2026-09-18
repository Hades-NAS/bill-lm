import { Client } from 'minio'

import { logger } from '../logger.server'

import { env } from '#/env'

export const minioClient = new Client({
  useSSL: true,
  endPoint: env.MINIO_ENDPOINT.replace(/^https?:\/\//, ''),
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
})

export async function ensureBucketsExist() {
  const buckets = ['payments', 'documents', 'receipts']

  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket)
      if (!exists) {
        await minioClient.makeBucket(bucket, 'us-east-1')
        logger.info(`✅ Bucket creado: ${bucket}`)
      }
    } catch (error) {
      logger.error(
        `❌ Error al verificar/crear bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
