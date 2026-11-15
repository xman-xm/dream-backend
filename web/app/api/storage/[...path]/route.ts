
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth-unified";
import { getLocalVideoPath, getStoredVideo, isBlobStorageConfigured } from "@/lib/video-storage";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: urlPath } = await params;
        const filename = urlPath.join("/");
        if (urlPath.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) {
            return new NextResponse("Invalid path", { status: 400 });
        }
        const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(filename);

        if (isVideo) {
            if (!await getCurrentUser(request)) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            if (process.env.VERCEL && !isBlobStorageConfigured()) {
                return NextResponse.json(
                    { error: "Video storage is not configured. Connect a private Vercel Blob store." },
                    { status: 503 },
                );
            }

            const blob = await getStoredVideo(filename, request.headers.get("range"));
            if (blob?.statusCode === 200) {
                const contentRange = blob.headers.get("content-range");
                const headers = new Headers({
                    "Content-Type": blob.headers.get("content-type") || blob.blob.contentType,
                    "Cache-Control": "private, no-cache",
                    "Accept-Ranges": blob.headers.get("accept-ranges") || "bytes",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
                });
                const contentLength = blob.headers.get("content-length");
                if (contentLength) headers.set("Content-Length", contentLength);
                else if (!contentRange) headers.set("Content-Length", String(blob.blob.size));
                if (contentRange) headers.set("Content-Range", contentRange);

                return new NextResponse(blob.stream, {
                    status: contentRange ? 206 : 200,
                    headers,
                });
            }

            const filepath = getLocalVideoPath(filename);
            if (!fs.existsSync(filepath)) {
                return new NextResponse("File not found", { status: 404 });
            }

            const stat = fs.statSync(filepath);
            const range = request.headers.get("range");
            const contentType = filename.endsWith(".webm") ? "video/webm" : "video/mp4";
            const commonHeaders = {
                "Accept-Ranges": "bytes",
                "Content-Type": contentType,
                "Cache-Control": "private, no-cache",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
            };

            if (range) {
                const match = /^bytes=(\d+)-(\d*)$/.exec(range);
                if (!match) {
                    return new NextResponse(null, {
                        status: 416,
                        headers: { "Content-Range": `bytes */${stat.size}` },
                    });
                }
                const start = Number(match[1]);
                const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
                if (start >= stat.size || end < start) {
                    return new NextResponse(null, {
                        status: 416,
                        headers: { "Content-Range": `bytes */${stat.size}` },
                    });
                }
                const stream = fs.createReadStream(filepath, { start, end });
                return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
                    status: 206,
                    headers: {
                        ...commonHeaders,
                        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                        "Content-Length": String(end - start + 1),
                    },
                });
            }

            const stream = fs.createReadStream(filepath);
            return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
                headers: { ...commonHeaders, "Content-Length": String(stat.size) },
            });
        }

        // Construct the absolute path to the file in the storage directory
        // web/storage/filename
        const storageDir = path.join(process.cwd(), "storage");
        const filePath = path.join(storageDir, filename);

        // Prevent directory traversal attacks
        if (!filePath.startsWith(storageDir)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        if (!fs.existsSync(filePath)) {
            return new NextResponse("File not found", { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".gif") contentType = "image/gif";
        if (ext === ".mp4") contentType = "video/mp4";
        if (ext === ".webm") contentType = "video/webm";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Error serving file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
        },
    });
}
