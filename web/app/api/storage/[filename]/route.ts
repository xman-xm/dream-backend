import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-unified"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs" // Correct import for existsSync

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> } // Params must be awaited in recent Next.js versions
) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename } = await params

    // Basic sanitization
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '')
    const storageDir = join(process.cwd(), 'storage')
    const filepath = join(storageDir, safeFilename)

    if (!existsSync(filepath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    try {
        const fileBuffer = await readFile(filepath)

        // Determine content type (basic)
        let contentType = 'application/octet-stream'
        if (filename.endsWith('.png')) contentType = 'image/png'
        else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg'
        else if (filename.endsWith('.gif')) contentType = 'image/gif'
        else if (filename.endsWith('.mp4')) contentType = 'video/mp4'

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'private, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            }
        })
    } catch (error) {
        console.error("Error serving file:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
    })
}
