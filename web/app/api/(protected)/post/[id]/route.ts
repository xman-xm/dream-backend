import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

// Update a post
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        let body
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { caption, media } = body

        // Handle media input similar to POST
        let mediaUrl = undefined;
        let mediaType = undefined;

        if (Array.isArray(media) && media.length > 0) {
            mediaUrl = media[0].url;
            mediaType = media[0].type;
        } else if (media && typeof media === 'object') {
            mediaUrl = media.url;
            mediaType = media.type;
        }
        // If media is not passed, we might want to keep existing. 
        // But for explicit update, if values are undefined they won't overwrite in prisma unless we explicitly check.
        // Prisma update ignores undefined values in 'data' usually? No, it doesn't automatically.
        // We need to construct the data object carefully.

        const updateData: any = {}
        if (caption !== undefined) updateData.caption = caption
        if (mediaUrl !== undefined) updateData.media = mediaUrl
        if (mediaType !== undefined) updateData.type = mediaType

        const post = await prisma.post.update({
            where: { id },
            data: updateData,
            include: {
                author: true
            }
        })

        return NextResponse.json(post)
    } catch (error) {
        console.error('Error updating post:', error)
        return NextResponse.json({ error: 'Error updating post' }, { status: 500 })
    }
}

// Delete a post
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        await prisma.post.delete({
            where: { id }
        })

        return NextResponse.json({ message: 'Post deleted successfully' })
    } catch (error) {
        console.error('Error deleting post:', error)
        return NextResponse.json({ error: 'Error deleting post' }, { status: 500 })
    }
}
