import { minioClient } from './client'

import type Stream from 'node:stream'

import { env } from '#/env'


export const mimeTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'text/xml': 'xml',
  'application/pdf': 'pdf',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpg': 'jpg',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
}

export const allowedMimeTypes = Object.keys(mimeTypes)


export abstract class StorageHelper {

  static readonly BUCKET_NAME = env.MINIO_BUCKET_NAME

  static getExtensionFromContentType(contentType: string): string {
    return mimeTypes[contentType] || 'bin'
  }

  static async getObjectURL(
    key: string,
    expiresIn: number = 7 * 24 * 60 * 60, // 7 días
  ): Promise<string> {
    try {
      return await minioClient.presignedGetObject(this.BUCKET_NAME, key, expiresIn)
    } catch (error) {
      throw new Error(`Failed to generate object URL for ${this.BUCKET_NAME}/${key}: ${error}`)
    }
  }

  /**
   * Sube un objeto a Minio
   * @param bucket - Nombre del bucket
   * @param key - Clave/ruta donde guardar el objeto
   * @param data - Contenido del archivo (Buffer o Stream)
   * @param contentType - Tipo MIME (ej: 'application/pdf', 'image/jpeg')
   * @param metadata - Metadata adicional opcional
   * @returns Clave del objeto subido
   */
  static async putObject(
    key: string,
    data: Buffer | Stream.Readable,
    contentType: string,
  ): Promise<string> {
    try {
      await minioClient.putObject(
        this.BUCKET_NAME,
        key,
        data,
        undefined,
        { 'Content-Type': contentType }
      )

      return key
    } catch (error) {
      throw new Error(`Failed to upload object to ${this.BUCKET_NAME}/${key}: ${error}`)
    }
  }

  /**
   * Obtiene un objeto de Minio como Buffer
   * @param bucket - Nombre del bucket
   * @param key - Clave/ruta del objeto a obtener
   * @returns Contenido del objeto como Buffer
   */
  static async getObject(key: string): Promise<Buffer> {
    try {
      const stream = await minioClient.getObject(this.BUCKET_NAME, key)

      const chunks: Array<Buffer> = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    } catch (error) {
      throw new Error(`Failed to get object from ${this.BUCKET_NAME}/${key}: ${error}`)
    }
  }

  /**
   * Elimina un objeto de Minio
   * @param bucket - Nombre del bucket
   * @param key - Clave/ruta del objeto a eliminar
   * @returns true si se eliminó exitosamente
   */
  static async deleteObject(key: string): Promise<boolean> {
    try {
      await minioClient.removeObject(this.BUCKET_NAME, key)

      return true
    } catch (error) {
      throw new Error(`Failed to delete object from ${this.BUCKET_NAME}/${key}: ${error}`)
    }
  }

}
