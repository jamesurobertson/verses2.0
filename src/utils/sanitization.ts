import { z } from 'zod';

/**
 * Sanitizes Bible reference input to prevent XSS and ensure valid format.
 * 
 * @param input - Raw Bible reference input from user
 * @returns Sanitized Bible reference string
 */
export function sanitizeBibleReference(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Bible reference must be a string');
  }

  // Remove potentially harmful characters while preserving valid Bible reference characters
  const sanitized = input
    .trim()
    .replace(/[<>"'&]/g, '') // Remove HTML/XSS characters
    .replace(/[^\w\s:;,\-.()[\]]/g, '') // Only allow alphanumeric, spaces, and Bible reference punctuation
    .substring(0, 200); // Limit length to prevent abuse

  if (sanitized.length === 0) {
    throw new Error('Bible reference cannot be empty after sanitization');
  }

  return sanitized;
}

/**
 * Sanitizes general text input for display purposes.
 * 
 * @param input - Raw text input
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized text string
 */
export function sanitizeText(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Basic HTML escaping and length limiting
  const sanitized = input
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, maxLength);

  return sanitized;
}

/**
 * Validates and sanitizes Bible reference input using Zod schema.
 */
export const bibleReferenceSchema = z
  .string()
  .min(1, 'Bible reference cannot be empty')
  .max(200, 'Bible reference too long')
  .transform(sanitizeBibleReference)
  .refine(
    (ref) => /^[a-zA-Z0-9\s:;,\-.()[\]]+$/.test(ref),
    'Bible reference contains invalid characters'
  );

/**
 * Validates user search input.
 */
export const searchInputSchema = z
  .string()
  .min(1, 'Search query cannot be empty')
  .max(100, 'Search query too long')
  .transform((input) => sanitizeText(input, 100));

/**
 * Validates user notes/comments input.
 */
export const userNotesSchema = z
  .string()
  .max(2000, 'Notes too long')
  .transform((input) => sanitizeText(input, 2000));