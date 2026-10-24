import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-unified"
import { createReadStream, statSync, existsSync } from "fs" // synchronous stat is fine for this checking
import { join } from "path"
import { Readable } from 'stream'

export async function GET(
    request: Request,
    props: { params: Promise<{ filename: string }> }
) {
    const { filename } = await props.params
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '')
    const isGeneratedVideo = safeFilename.startsWith('generated-') && safeFilename.endsWith('.mp4')

    if (!isGeneratedVideo && !await getCurrentUser(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storageDir = join(process.cwd(), 'storage')
    const filepath = join(storageDir, safeFilename)

    if (!existsSync(filepath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    try {
        const stat = statSync(filepath)
        const fileSize = stat.size
        const range = request.headers.get('range')

        let contentType = 'application/octet-stream'
        if (filename.endsWith('.png')) contentType = 'image/png'
        else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg'
        else if (filename.endsWith('.gif')) contentType = 'image/gif'
        else if (filename.endsWith('.mp4')) contentType = 'video/mp4'

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = (end - start) + 1
            const fileStream = createReadStream(filepath, { start, end })

            const stream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>

            return new NextResponse(stream, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize.toString(),
                    'Content-Type': contentType,
                    'Cache-Control': 'private, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
                }
            })
        } else {
            const fileStream = createReadStream(filepath)
            const stream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>

            return new NextResponse(stream, {
                status: 200,
                headers: {
                    'Content-Length': fileSize.toString(),
                    'Content-Type': contentType,
                    'Cache-Control': 'private, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
                }
            })
        }
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
