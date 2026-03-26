import type { FileWithPath } from '@mantine/dropzone'

export const fileToBase64 = (file: FileWithPath): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
  })
}

export const filesToBase64 = async (files: Array<FileWithPath>) => {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      base64: await fileToBase64(file),
      mimeType: file.type as 'application/pdf' | 'text/xml',
    })),
  )
}
