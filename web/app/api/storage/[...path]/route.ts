
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: urlPath } = await params;
        const filename = urlPath.join("/");

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
