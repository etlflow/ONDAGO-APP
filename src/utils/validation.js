import { z } from 'zod';

// Flight Number validator (e.g. AA123)
export const flightNumberSchema = z
  .string()
  .trim()
  .min(3, 'Flight number must be at least 3 characters')
  .max(10, 'Flight number cannot exceed 10 characters')
  .regex(/^[A-Z]{2}\d{1,4}$/i, 'Invalid flight format. Must start with 2 letters followed by 1 to 4 digits (e.g. AA123).');

// Child Item validator
export const childSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name is too long'),
  age: z.number().int().min(0, 'Age must be 0 or higher').max(18, 'Age cannot exceed 18')
});

// User Profile validator
export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100, 'Name is too long'),
  children: z.array(childSchema).max(10, 'You can add up to 10 children profiles'),
  preferredAirports: z.array(z.string().length(3)).max(5, 'Maximum 5 preferred airports'),
  mfaEnabled: z.boolean().default(false)
});

// Journal note validator
export const journalNoteSchema = z
  .string()
  .trim()
  .min(1, 'Journal note cannot be empty')
  .max(2000, 'Journal note cannot exceed 2000 characters');

// Share trip note validator
export const shareNoteSchema = z
  .string()
  .trim()
  .max(500, 'Share note cannot exceed 500 characters');
