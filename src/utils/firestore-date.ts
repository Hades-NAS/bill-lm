/**
 * Safely convert Firestore Timestamp or various date formats to JavaScript Date
 * Handles: Firestore Timestamp, Date, number (ms), string (ISO), null/undefined
 */
export function toDate(value: any): Date {
  if (!value) {
    return new Date()
  }

  // Already a Date
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value
  }

  // Firestore Timestamp (has toDate method)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date
      : new Date()
  }

  // Number (milliseconds since epoch)
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date() : date
  }

  // String (ISO format)
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date() : date
  }

  // Fallback for edge cases
  return new Date()
}
