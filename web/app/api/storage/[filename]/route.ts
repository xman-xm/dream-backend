import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-unified"
import { createReadStream, statSync, existsSync } from "fs" // synchronous stat is fine for this checking
import { join } from "path"
import { Readable } from 'stream'

export async function GET(
    request: Request,
    props: { params: Promise<{ filename: string }> }
) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename } = await props.params

    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '')
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

            // Convert node stream to web stream for NextResponse
            // @ts-ignore
            const stream = Readable.toWeb(fileStream)

            return new NextResponse(stream as any, {
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
            // @ts-ignore
            const stream = Readable.toWeb(fileStream)

            return new NextResponse(stream as any, {
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
