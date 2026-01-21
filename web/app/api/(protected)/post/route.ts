import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"
import { writeFile } from "fs/promises"
import { join } from "path"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // 1. Get User's Friend IDs
        const memberships = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { requesterId: user.id },
                    { addresseeId: user.id }
                ]
            },
            select: {
                requesterId: true,
                addresseeId: true
            }
        })

        const friendIds = new Set<string>()
        memberships.forEach(f => {
            friendIds.add(f.requesterId === user.id ? f.addresseeId : f.requesterId)
        })

        let whereCondition: any = {}

        // 2. Feed Algorithm
        if (friendIds.size > 0) {
            // "Friends Feed": Show ONLY my friends' posts (User requested to exclude self)
            whereCondition = {
                authorId: {
                    in: Array.from(friendIds)
                }
            }
        } else {
            // "Global Cold Start": User has no friends, show everything EXCEPT my own posts
            whereCondition = {
                authorId: {
                    not: user.id
                }
            }
        }

        const posts = await prisma.post.findMany({
            where: whereCondition,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: true,
                likes: {
                    where: { userId: user.id } // optimal way to see if I liked it
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true
                    }
                }
            },
            take: 50
        })

        // Enhance post object with 'isLiked'
        const enhancedPosts = posts.map(post => ({
            ...post,
            isLiked: post.likes.length > 0
        }))

        return NextResponse.json(enhancedPosts)
    } catch (error) {
        console.error("Feed error:", error)
        return NextResponse.json({ error: 'Error fetching feed' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const caption = formData.get('caption') as string
        const authorId = formData.get('authorId') as string
        const groupId = formData.get('groupId') as string | null
        const file = formData.get('image') as File | null

        if (!authorId) {
            return NextResponse.json({ error: 'Author ID is required' }, { status: 400 })
        }

        let mediaUrl = ''
        let mediaType = 'IMAGE'

        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)

            // Ensure unique filename
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
            const filename = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

            // Save to secure storage (not public)
            const uploadDir = join(process.cwd(), 'storage')
            const filepath = join(uploadDir, filename)

            await writeFile(filepath, buffer)

            // Set secure API URL
            mediaUrl = `/api/storage/${filename}`

            // Simple type detection
            if (file.type.startsWith('video/')) {
                mediaType = 'VIDEO'
            }
        }

        const post = await prisma.post.create({
            data: {
                caption: caption || '',
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
