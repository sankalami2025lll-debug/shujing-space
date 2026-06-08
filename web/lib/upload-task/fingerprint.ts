"use client";

const SAMPLE_SIZE_BYTES = 1024 * 1024;
const SMALL_FILE_THRESHOLD_BYTES = 3 * 1024 * 1024;

export interface UploadFileFingerprint {
  fingerprintAlgo: "sample-sha256-v1";
  fingerprint: string;
  sampleHash: string;
}

function concatBuffers(buffers: ArrayBuffer[]): Uint8Array {
  const total = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const buffer of buffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return combined;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function sha256Hex(data: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readSampleBuffers(file: File): Promise<ArrayBuffer[]> {
  if (file.size < SMALL_FILE_THRESHOLD_BYTES) {
    return [await file.arrayBuffer()];
  }

  const head = await file.slice(0, SAMPLE_SIZE_BYTES).arrayBuffer();
  const middleStart = Math.max(0, Math.floor((file.size - SAMPLE_SIZE_BYTES) / 2));
  const middle = await file
    .slice(middleStart, middleStart + SAMPLE_SIZE_BYTES)
    .arrayBuffer();
  const tailStart = Math.max(0, file.size - SAMPLE_SIZE_BYTES);
  const tail = await file.slice(tailStart, file.size).arrayBuffer();
  return [head, middle, tail];
}

export async function createUploadFileFingerprint(
  file: File,
): Promise<UploadFileFingerprint> {
  const sampleBuffers = await readSampleBuffers(file);
  const sampleHash = await sha256Hex(concatBuffers(sampleBuffers));
  const fingerprintPayload = encodeText(
    `${file.name}\n${file.size}\n${file.lastModified}\n${sampleHash}`,
  );
  const fingerprint = await sha256Hex(fingerprintPayload);

  return {
    fingerprintAlgo: "sample-sha256-v1",
    fingerprint,
    sampleHash,
  };
}
