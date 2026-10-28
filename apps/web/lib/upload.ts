import {
  UPLOAD_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type ImageInput,
  type PresignUploadResult,
  type UploadContentType,
  type UploadFolder,
} from "@catafy/types";
import { api } from "./api";

export const ACCEPTED_IMAGE_TYPES = Object.keys(UPLOAD_CONTENT_TYPES).join(",");

function isAllowedType(type: string): type is UploadContentType {
  return type in UPLOAD_CONTENT_TYPES;
}

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

function put(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void,
) {
  // XHR rather than fetch: fetch has no upload progress events.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). Check the R2 bucket CORS settings.`));
    xhr.onerror = () =>
      reject(new Error("Upload blocked. Check the R2 bucket CORS settings allow this site."));
    xhr.send(file);
  });
}

/** Validates, presigns, uploads straight to R2 and returns the image record to save. */
export async function uploadImage(
  file: File,
  folder: UploadFolder,
  onProgress?: (pct: number) => void,
): Promise<ImageInput> {
  if (!isAllowedType(file.type)) throw new Error(`${file.name}: only JPEG, PNG, WebP or AVIF`);
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new Error(`${file.name}: must be ${UPLOAD_MAX_BYTES / 1024 / 1024} MB or smaller`);
  }
  const { width, height } = await readDimensions(file);
  const presigned = await api<PresignUploadResult>("/admin/uploads/presign", {
    method: "POST",
    body: { folder, contentType: file.type, size: file.size },
  });
  await put(presigned.uploadUrl, file, presigned.headers, onProgress);
  return { key: presigned.key, width, height, alt: "" };
}
