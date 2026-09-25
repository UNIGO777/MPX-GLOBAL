import { describe, it, expect } from 'vitest';

import { CHAT_FILE_MAX_MB, chatFileProblem, fileBadge, formatFileSize } from '../../src/lib/chatFiles.js';

const MB = 1024 * 1024;
const file = (name, type, size = 10_000) => ({ name, type, size });

describe('chat attachments (D9 images · D10 documents)', () => {
  it('documents: PDF, Word .docx and Excel .xlsx only', () => {
    expect(chatFileProblem(file('quote.pdf', 'application/pdf'), 'document')).toBeNull();
    expect(chatFileProblem(file('spec.DOCX', ''), 'document')).toBeNull();
    expect(chatFileProblem(file('sheet.xlsx', ''), 'document')).toBeNull();
    // Legacy and macro-enabled formats are NOT covered by D10.
    for (const name of ['old.doc', 'old.xls', 'macro.docm', 'macro.xlsm', 'files.zip', 'run.exe']) {
      expect(chatFileProblem(file(name, ''), 'document'), name).toMatch(/Only PDF/);
    }
  });

  it('images: JPG, PNG, WEBP or GIF only', () => {
    expect(chatFileProblem(file('a.png', 'image/png'), 'image')).toBeNull();
    expect(chatFileProblem(file('a.svg', 'image/svg+xml'), 'image')).toMatch(/Only JPG/);
    expect(chatFileProblem(file('a.heic', 'image/heic'), 'image')).toMatch(/Only JPG/);
  });

  it(`anything over ${CHAT_FILE_MAX_MB} MB is refused before upload`, () => {
    expect(chatFileProblem(file('big.pdf', 'application/pdf', CHAT_FILE_MAX_MB * MB + 1), 'document')).toMatch(/over/);
    expect(chatFileProblem(file('ok.pdf', 'application/pdf', CHAT_FILE_MAX_MB * MB), 'document')).toBeNull();
  });

  it('badges and sizes', () => {
    expect(fileBadge('report.final.pdf')).toBe('PDF');
    expect(fileBadge('xlsx')).toBe('XLSX');
    expect(fileBadge('')).toBe('FILE');
    expect(formatFileSize(500)).toBe('1 KB');
    expect(formatFileSize(3.25 * MB)).toBe('3.3 MB');
  });
});
