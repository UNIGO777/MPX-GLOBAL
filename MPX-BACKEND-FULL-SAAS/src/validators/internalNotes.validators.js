import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { NOTE_SUBJECTS } from '../models/InternalNote.js';

// Step 1c · staff-only internal notes.
export const listNotes = {
  query: z.object({ subjectType: z.enum(NOTE_SUBJECTS), subjectId: zObjectId() }),
};

export const addNote = {
  body: z.object({
    subjectType: z.enum(NOTE_SUBJECTS),
    subjectId: zObjectId(),
    body: zString({ min: 1, max: 2000 }),
  }),
};
