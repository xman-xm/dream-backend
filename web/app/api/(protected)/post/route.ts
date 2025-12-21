import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const posts = await prisma.post.findMany({
        include: {
            author: true
        }
    })
    return NextResponse.json(posts)
}

export async function POST(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        let body;
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { caption, authorId, groupId, media } = body

        if (!authorId) {
            return NextResponse.json({ error: 'Author ID is required' }, { status: 400 })
        }

        // Handle media input which might be an array (from old test) or object
        let mediaUrl = '';
        let mediaType = 'IMAGE';

        if (Array.isArray(media) && media.length > 0) {
            mediaUrl = media[0].url;
            mediaType = media[0].type;
        } else if (media && typeof media === 'object') {
            mediaUrl = media.url || '';
            mediaType = media.type || 'IMAGE';
        }

        const post = await prisma.post.create({
            data: {
                caption,
                authorId,
                groupId,
                media: mediaUrl,
                type: mediaType
            },
            include: {
                author: true
            }
        })

        return NextResponse.json(post)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Error creating post' }, { status: 500 })
    }
}
