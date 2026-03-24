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
    return value
  }

  // Firestore Timestamp (has toDate method)
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate()
  }

  // Number (milliseconds since epoch)
  if (typeof value === 'number') {
    return new Date(value)
  }

  // String (ISO format)
  if (typeof value === 'string') {
    return new Date(value)
  }

  // Fallback for edge cases
  return new Date()
}
