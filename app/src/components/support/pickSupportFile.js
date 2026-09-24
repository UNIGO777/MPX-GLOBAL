import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { DOCUMENT_MIME, chatFileProblem } from '../../utils/chatFiles.js';

/**
 * Pick ONE file for a support ticket — a photo or a PDF/.docx/.xlsx, same rules
 * as chat. Returns { file } or { problem } or null when cancelled.
 */
export async function pickSupportFile(kind) {
  if (kind === 'image') {
    // quality < 1 re-encodes to JPEG — an iPhone's HEIC would be refused otherwise.
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, exif: false });
    const a = !res.canceled && res.assets?.[0];
    if (!a) return null;
    const file = { uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize };
    const problem = chatFileProblem(file, 'image');
    return problem ? { problem } : { file };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_MIME, copyToCacheDirectory: true });
  const a = !res.canceled && res.assets?.[0];
  if (!a) return null;
  const file = { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size };
  const problem = chatFileProblem(file, 'document');
  return problem ? { problem } : { file };
}
