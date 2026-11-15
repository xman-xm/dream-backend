import { put } from "@vercel/blob";
import dotenv from "dotenv";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

dotenv.config({
  path: [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")],
});

const hasBlobCredentials = Boolean(
  process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
);

if (!hasBlobCredentials) {
  console.error(
    "Vercel Blob credentials are missing. Connect the private store and run `vercel env pull` first.",
  );
  process.exit(1);
}

const storageRoot = resolve(process.cwd(), "storage");
const videoTypes = new Map([
  [".mp4", "video/mp4"],
  [".m4v", "video/x-m4v"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
]);
const files = [];

async function collectVideos(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectVideos(fullPath);
    } else if (entry.isFile() && videoTypes.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
}

await collectVideos(storageRoot);

if (files.length === 0) {
  console.log(`No video files found under ${storageRoot}.`);
  process.exit(0);
}

for (const filePath of files) {
  const pathname = relative(storageRoot, filePath).split(sep).join("/");
  const extension = extname(filePath).toLowerCase();
  const { size } = await stat(filePath);
  const blob = await put(pathname, createReadStream(filePath), {
    access: "private",
    contentType: videoTypes.get(extension),
    multipart: size > 100 * 1024 * 1024,
    allowOverwrite: true,
  });
  console.log(`Uploaded ${pathname} (${size} bytes) -> ${blob.pathname}`);
}

console.log(`Migrated ${files.length} video file(s).`);
