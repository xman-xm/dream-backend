import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''
        const type = searchParams.get('type') || 'all' // all, users, posts

        if (!query.trim()) {
            return NextResponse.json({ users: [], posts: [] })
        }

        const normalizedQuery = query.trim().toLowerCase()

        // 1. Search Users
        let users: any[] = []
        if (type === 'all' || type === 'users') {
            users = await prisma.user.findMany({
                where: {
                    OR: [
                        { username: { contains: normalizedQuery, mode: 'insensitive' } },
                        { name: { contains: normalizedQuery, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    avatarUrl: true
                },
                take: 20
            })
        }

        // 2. Search Posts (Caption OR AI Description)
        let posts: any[] = []
        if (type === 'all' || type === 'posts') {
            posts = await prisma.post.findMany({
                where: {
                    OR: [
                        { caption: { contains: normalizedQuery, mode: 'insensitive' } },
                        { aiDescription: { contains: normalizedQuery, mode: 'insensitive' } }
                    ]
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            avatarUrl: true
                        }
                    },
                    _count: {
                        select: {
                            likes: true,
                            comments: true
                        }
                    },
                    likes: {
                        where: { userId: user.id },
                        select: { id: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 20
            })
        }

        return NextResponse.json({
            users,
            posts
        })

    } catch (error) {
        console.error("Search error:", error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
