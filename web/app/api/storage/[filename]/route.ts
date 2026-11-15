import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-unified"
import { getStoredVideo, getLocalVideoPath, isBlobStorageConfigured } from "@/lib/video-storage"
import { createReadStream, statSync, existsSync } from "fs" // synchronous stat is fine for this checking
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

    const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(safeFilename)
    const range = request.headers.get('range')

    if (isVideo) {
        if (process.env.VERCEL && !isBlobStorageConfigured()) {
            return NextResponse.json(
                { error: 'Video storage is not configured. Connect a private Vercel Blob store.' },
                { status: 503 },
            )
        }

        try {
            const blob = await getStoredVideo(safeFilename, range)
            if (blob?.statusCode === 200) {
                const contentRange = blob.headers.get('content-range')
                const headers = new Headers({
                    'Content-Type': blob.headers.get('content-type') || blob.blob.contentType,
                    'Cache-Control': 'private, no-cache',
                    'Accept-Ranges': blob.headers.get('accept-ranges') || 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range',
                })
                const contentLength = blob.headers.get('content-length')
                if (contentLength) headers.set('Content-Length', contentLength)
                else if (!contentRange) headers.set('Content-Length', String(blob.blob.size))
                if (contentRange) headers.set('Content-Range', contentRange)

                return new NextResponse(blob.stream, {
                    status: contentRange ? 206 : 200,
                    headers,
                })
            }
        } catch (error) {
            console.error('Error reading video from Blob storage:', error)
            return NextResponse.json({ error: 'Unable to retrieve video' }, { status: 502 })
        }
    }

    const filepath = getLocalVideoPath(safeFilename)

    if (!existsSync(filepath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    try {
        const stat = statSync(filepath)
        const fileSize = stat.size
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
                    'Cache-Control': 'private, no-cache',
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
                    'Cache-Control': 'private, no-cache',
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
