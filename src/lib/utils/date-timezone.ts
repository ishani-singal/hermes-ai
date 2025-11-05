/**
 * Date and Timezone Utilities
 * 
 * Handles conversion between local dates and UTC timestamps,
 * accounting for the user's timezone offset.
 */

/**
 * Convert a local date string (YYYY-MM-DD) to a UTC timestamp that represents
 * that date in the user's local timezone.
 * 
 * @example
 * // User is in PST and sets "2025-11-06"
 * localDateToUTC("2025-11-06")
 * // Returns ISO string for "2025-11-06 00:00:00 PST" converted to UTC
 * // Result: "2025-11-06T08:00:00.000Z"
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @returns ISO string representing that date at midnight in the user's timezone, converted to UTC
 */
export function localDateToUTC(dateString: string): string {
  // Parse as local date
  const [year, month, day] = dateString.split('-').map(Number)
  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0)
  
  // Convert to UTC by getting the offset and adjusting
  const offset = localDate.getTimezoneOffset() * 60000 // convert to milliseconds
  const utcDate = new Date(localDate.getTime() + offset)
  
  return utcDate.toISOString()
}

/**
 * Convert a UTC ISO timestamp back to a local date string (YYYY-MM-DD).
 * This reverses the conversion done by localDateToUTC.
 * 
 * @example
 * // UTC timestamp representing "2025-11-06 00:00:00 PST"
 * utcToLocalDateString("2025-11-06T08:00:00.000Z")
 * // Returns "2025-11-06"
 * 
 * @param isoString - ISO string timestamp (potentially with timezone info)
 * @returns Date string in YYYY-MM-DD format representing the local date
 */
export function utcToLocalDateString(isoString: string): string {
  // Parse the ISO string as UTC
  const utcDate = new Date(isoString)
  
  // Convert to local time by subtracting the timezone offset
  const offset = utcDate.getTimezoneOffset() * 60000
  const localDate = new Date(utcDate.getTime() - offset)
  
  // Extract year, month, day from local date
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}
