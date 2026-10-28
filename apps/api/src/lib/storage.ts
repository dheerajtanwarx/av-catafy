import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  UPLOAD_CONTENT_TYPES,
  type PresignUploadInput,
  type PresignUploadResult,
} from "@catafy/types";

const PRESIGN_TTL_SECONDS = 5 * 60;
// Keys are random UUIDs and never overwritten, so images can be cached forever.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface Storage {
  presignUpload(input: PresignUploadInput): Promise<PresignUploadResult>;
  publicUrl(key: string): string;
}

export interface R2Config {
  accountId: string;
  endpoint?: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function createR2Storage(config: R2Config): Storage {
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // R2 rejects the SDK's default CRC32 checksum headers on presigned browser uploads.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const publicBase = config.publicBaseUrl.replace(/\/+$/, "");

  return {
    publicUrl: (key) => `${publicBase}/${key}`,

    async presignUpload({ folder, contentType, size }) {
      const key = `${folder}/${randomUUID()}.${UPLOAD_CONTENT_TYPES[contentType]}`;
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        // Signed, so the browser cannot upload a different size than it declared.
        ContentLength: size,
        CacheControl: CACHE_CONTROL,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: PRESIGN_TTL_SECONDS,
        signableHeaders: new Set(["content-type", "content-length", "cache-control"]),
      });
      return {
        key,
        uploadUrl,
        publicUrl: `${publicBase}/${key}`,
        headers: { "Content-Type": contentType, "Cache-Control": CACHE_CONTROL },
      };
    },
  };
}
