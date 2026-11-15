import { get, put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const MAX_VIDEO_SIZE_FOR_MULTIPART = 100 * 1024 * 1024;

export function isBlobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  );
}

function getVideoContentType(filename: string, providedType?: string) {
  const extension = filename.split("/").at(-1)?.toLowerCase() ?? filename.toLowerCase();
  if (providedType?.startsWith("video/")) return providedType;
  if (extension.endsWith(".webm")) return "video/webm";
  if (extension.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function storeVideo(
  pathname: string,
  bytes: Buffer,
  contentType?: string,
) {
  const safePathname = pathname
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, ""))
    .join("/");
  if (
    !safePathname ||
    safePathname !== pathname ||
    pathname.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid video filename");
  }

  if (isBlobStorageConfigured()) {
    await put(safePathname, bytes, {
      access: "private",
      contentType: getVideoContentType(pathname, contentType),
      multipart: bytes.byteLength > MAX_VIDEO_SIZE_FOR_MULTIPART,
    });
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "Video storage is not configured. Connect a private Vercel Blob store to this project before uploading videos.",
      );
    }

    const filepath = getLocalVideoPath(safePathname);
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, bytes);
  }

  return `/api/storage/${safePathname}`;
}

export async function getStoredVideo(
  filename: string,
  rangeHeader: string | null,
) {
  if (!isBlobStorageConfigured()) return null;

  const blob = await get(filename, {
    access: "private",
    headers: rangeHeader ? { Range: rangeHeader } : undefined,
  });

  return blob;
}

export function getLocalVideoPath(filename: string) {
  const storageDir = resolve(process.cwd(), "storage");
  const filepath = resolve(storageDir, filename);
  const storagePrefix = `${storageDir}${sep}`;
  if (filepath !== storageDir && !filepath.startsWith(storagePrefix)) {
    throw new Error("Invalid video storage path");
  }
  return filepath;
}
