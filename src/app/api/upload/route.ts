import { NextRequest, NextResponse } from "next/server";
import { uploadFile, uploadFileStream } from "@/lib/storage";
import { Readable } from "stream";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const STREAM_THRESHOLD = 10 * 1024 * 1024; // Use streaming for files > 10MB

const ALLOWED_TYPES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/png": [0x89, 0x50, 0x4e, 0x47],       // PNG
  "image/jpeg": [0xff, 0xd8, 0xff],             // JPEG
  "image/webp": [0x52, 0x49, 0x46, 0x46],       // RIFF (WebP)
  "image/heic": [0x00, 0x00, 0x00],             // HEIC (ftyp box starts at offset 4)
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magic = ALLOWED_TYPES[mimeType];
  if (!magic) return false;
  // HEIC has ftyp at offset 4, special handling
  if (mimeType === "image/heic") {
    const ftyp = buffer.slice(4, 8).toString('ascii');
    return ftyp === 'ftyp';
  }
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate MIME type
    if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPEG, WEBP, HEIC` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 100MB." },
        { status: 400 }
      );
    }

    // Read first 16 bytes for magic byte validation
    const headerChunk = await file.slice(0, 16).arrayBuffer();
    const headerBuffer = Buffer.from(headerChunk);

    if (!validateMagicBytes(headerBuffer, file.type)) {
      return NextResponse.json(
        { error: "File content doesn't match declared type. Possible file spoofing." },
        { status: 400 }
      );
    }

    let result;

    if (file.size > STREAM_THRESHOLD) {
      // Use streaming for large files to reduce memory usage
      const webStream = file.stream();
      const nodeStream = Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0]);

      result = await uploadFileStream(
        nodeStream,
        file.name,
        file.type,
        file.size
      );
    } else {
      // Use buffer for small files (simpler, faster)
      const bytes = await file.arrayBuffer();
      result = await uploadFile(
        Buffer.from(bytes),
        file.name,
        file.type
      );
    }

    return NextResponse.json({
      fileUrl: result.url,
      mimeType: result.mimeType,
      size: result.size || file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
