import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export async function extractText(buffer: Buffer, fileType: 'pdf' | 'docx'): Promise<string> {
  if (fileType === 'pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${fileType}`);
}
