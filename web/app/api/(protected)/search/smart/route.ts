
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"
import { getEmbedding } from "@/lib/gemini"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''

        if (!query.trim()) {
            return NextResponse.json({ users: [], groups: [], posts: [] })
        }

        const normalizedQuery = query.trim().toLowerCase()
        const isShortQuery = normalizedQuery.length < 3
        const embedding = !isShortQuery ? await getEmbedding(query.trim()) : null

        // --- 1. SEARCH USERS (Keyword + Vector) ---
        let users: any[] = [];
        if (embedding) {
            const vectorStr = `[${embedding.join(',')}]`;
            users = await prisma.$queryRaw`
                SELECT id, username, name, "avatarUrl", bio,
                (embedding <=> ${vectorStr}::vector) as distance,
                word_similarity(${normalizedQuery}, username || ' ' || COALESCE(name, '')) as keyword_sim
                FROM "User"
                WHERE 
                   (username ILIKE ${'%' + normalizedQuery + '%'} OR name ILIKE ${'%' + normalizedQuery + '%'} ) 
                   OR 
                   (embedding <=> ${vectorStr}::vector) < 0.35
                ORDER BY 
                   CASE WHEN LOWER(username) = ${normalizedQuery} THEN 0 ELSE 1 END,
                   ((embedding <=> ${vectorStr}::vector) * 0.4 + (1 - word_similarity(${normalizedQuery}, username || ' ' || COALESCE(name, ''))) * 0.6) ASC
                LIMIT 15
            `;
        } else {
            users = await prisma.user.findMany({
                where: {
                    OR: [
                        { username: { contains: normalizedQuery, mode: 'insensitive' } },
                        { name: { contains: normalizedQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, username: true, name: true, avatarUrl: true, bio: true },
                take: 15
            });
        }

        // --- 2. SEARCH GROUPS (Keyword + Vector) ---
        let groups: any[] = [];
        if (embedding) {
            const vectorStr = `[${embedding.join(',')}]`;
            groups = await prisma.$queryRaw`
                SELECT id, name, description, "avatarUrl",
                (embedding <=> ${vectorStr}::vector) as distance,
                word_similarity(${normalizedQuery}, name || ' ' || COALESCE(description, '')) as keyword_sim
                FROM "Group"
                WHERE 
                   (name ILIKE ${'%' + normalizedQuery + '%'} OR description ILIKE ${'%' + normalizedQuery + '%'})
                   OR
                   (embedding <=> ${vectorStr}::vector) < 0.5
                ORDER BY 
                   CASE WHEN LOWER(name) = ${normalizedQuery} THEN 0 ELSE 1 END,
                   ((embedding <=> ${vectorStr}::vector) * 0.4 + (1 - word_similarity(${normalizedQuery}, name || ' ' || COALESCE(description, ''))) * 0.6) ASC
                LIMIT 15
             `;
        } else {
            groups = await prisma.group.findMany({
                where: {
                    OR: [
                        { name: { contains: normalizedQuery, mode: 'insensitive' } },
                        { description: { contains: normalizedQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, description: true, avatarUrl: true },
                take: 15
            })
        }

        // --- 3. SEARCH POSTS (Keyword + Vector) ---
        let posts: any[] = [];
        if (embedding) {
            const vectorStr = `[${embedding.join(',')}]`;
            posts = await prisma.$queryRaw`
                SELECT p.id, p.caption, p.media, p.type, p."aiDescription", p."createdAt",
                       u.id as "authorId", u.username as "authorUsername", u.name as "authorName", u."avatarUrl" as "authorAvatar",
                       (p.embedding <=> ${vectorStr}::vector) as distance,
                       word_similarity(${normalizedQuery}, COALESCE(p.caption, '') || ' ' || COALESCE(p."aiDescription", '')) as keyword_sim
                FROM "Post" p
                JOIN "User" u ON p."authorId" = u.id
                WHERE 
                   (p.caption ILIKE ${'%' + normalizedQuery + '%'} OR p."aiDescription" ILIKE ${'%' + normalizedQuery + '%'})
                   OR
                   (p.embedding <=> ${vectorStr}::vector) < 0.5
                ORDER BY 
                   ((p.embedding <=> ${vectorStr}::vector) * 0.5 + (1 - word_similarity(${normalizedQuery}, COALESCE(p.caption, '') || ' ' || COALESCE(p."aiDescription", ''))) * 0.5) ASC
                LIMIT 30
             `;

            posts = posts.map(p => ({
                id: p.id,
                caption: p.caption,
                media: p.media,
                type: p.type,
                aiDescription: p.aiDescription,
                createdAt: p.createdAt,
                author: {
                    id: p.authorId,
                    username: p.authorUsername,
                    name: p.authorName,
                    avatarUrl: p.authorAvatar
                },
                _count: { likes: 0, comments: 0 },
                likes: []
            }));

        } else {
            const postData = await prisma.post.findMany({
                where: {
                    OR: [
                        { caption: { contains: normalizedQuery, mode: 'insensitive' } },
                        { aiDescription: { contains: normalizedQuery, mode: 'insensitive' } }
                    ]
                },
                include: {
                    author: { select: { id: true, username: true, name: true, avatarUrl: true } }
                },
                take: 30,
                orderBy: { createdAt: 'desc' }
            });
            posts = postData.map(p => ({ ...p, _count: { likes: 0, comments: 0 }, likes: [] }));
        }

        return NextResponse.json({
            users: users.map(u => ({ ...u, id: u.id })),
            groups: groups.map(g => ({ ...g, id: g.id })),
            posts
        })

    } catch (error) {
        console.error("Smart Search error:", error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
