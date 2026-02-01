import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth-unified"
import { writeFile } from "fs/promises"
import { join } from "path"
import { sendPushNotification } from "@/lib/notifications"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const userIdFilter = searchParams.get('userId')
        const limit = 5
        const cursorScore = parseFloat(searchParams.get('cursor') || '999999')

        // 1. Profile Mode (Chronological)
        if (userIdFilter) {
            const posts = await prisma.post.findMany({
                where: { authorId: userIdFilter },
                orderBy: { createdAt: 'desc' },
                include: {
                    author: true,
                    likes: { where: { userId: user.id } },
                    _count: { select: { likes: true, comments: true } }
                },
                take: 20 // Standard limit for profile
            })

            const enhancedPosts = posts.map(post => ({
                ...post,
                isLiked: post.likes.length > 0
            }))
            return NextResponse.json(enhancedPosts)
        }

        // 2. Smart Feed Mode
        // Get User's Interest Vector (or default to empty if brand new)
        const userResult = await prisma.$queryRaw`
            SELECT "interestEmbedding" FROM "User" WHERE id = ${user.id}
        ` as any[]
        const userRecord = userResult[0] || null

        // If no vector, we use a zero vector (neutral) or just rely on reactions
        // For Postgres pgvector, we can't query 'null' distance easily if column is null.
        // But our strategy: if null, we rely 100% on popularity.

        // Raw SQL for the Algorithm
        // Note: <=> is distance (0=same, 2=opposite). 
        // Similarity = 1 - (<=>).

        // We cast count to float to avoid division issues.
        // We use LOG10 for reaction scaling so 1M likes doesn't break math vs 10 likes.

        const hasInterest = !!(userRecord as any)?.interestEmbedding

        const rawPosts = await prisma.$queryRaw`
            SELECT 
                p.id, 
                p."createdAt", 
                p.caption, 
                p.media, 
                p.type,
                p."authorId", 
                u.name as author_name, 
                u.username as "author_username", 
                u."avatarUrl" as "author_avatarUrl",
                COUNT(l.id) as like_count,
                COUNT(c.id) as comment_count,
                MAX(CASE WHEN l."userId" = ${user.id} THEN 1 ELSE 0 END) as is_liked,
                
                -- Scoring Components
                -- 1. Similarity (0 to 1). If no interest vector, default to 0.5 (neutral)
                ${hasInterest
                // @ts-ignore
                ? Prisma.sql`(1 - (p.embedding <=> ${userRecord.interestEmbedding}))`
                : Prisma.sql`0.5`} as similarity_score,

                -- 2. Social Multiplier (1.75x for Friends, 1.1x Global)
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM "Friendship" f 
                        WHERE (f."requesterId" = ${user.id} AND f."addresseeId" = p."authorId" AND f.status = 'ACCEPTED')
                        OR (f."addresseeId" = ${user.id} AND f."requesterId" = p."authorId" AND f.status = 'ACCEPTED')
                    ) THEN 1.75
                    ELSE 1.1
                END as social_multiplier
            
            FROM "Post" p
            JOIN "User" u ON p."authorId" = u.id
            LEFT JOIN "Like" l ON p.id = l."postId"
            LEFT JOIN "Comment" c ON p.id = c."postId"
            
            GROUP BY p.id, u.id
            
            -- Calculate Final Score
            -- Score = ( (Sim * 0.7) + (NormalizedReactions * 0.3) ) * Multiplier
            -- NormalizedReactions: Log10 of (likes + comments + 1) / 5 (Max sensible ~100k => 5)
            ORDER BY 
                (
                    (
                        (${hasInterest ? Prisma.sql`(1 - (p.embedding <=> ${(userRecord as any).interestEmbedding}))` : Prisma.sql`0.5`} * 0.7) 
                        + 
                        ((LEAST(LOG(COUNT(l.id) + COUNT(c.id) + 1), 5) / 5) * 0.3)
                    ) 
                    * 
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM "Friendship" f 
                            WHERE (f."requesterId" = ${user.id} AND f."addresseeId" = p."authorId" AND f.status = 'ACCEPTED')
                            OR (f."addresseeId" = ${user.id} AND f."requesterId" = p."authorId" AND f.status = 'ACCEPTED')
                        ) THEN 1.75
                        ELSE 1.1
                    END
                ) DESC
            
            LIMIT ${limit}
        ` as any[]

        // Format for Frontend
        // We'll need to manually construct the JSON structure since raw query is flat
        const formattedPosts = rawPosts.map((row: any) => ({
            id: row.id,
            createdAt: row.createdAt,
            caption: row.caption,
            media: row.media,
            type: row.type,
            authorId: row.authorId,
            author: {
                id: row.authorId,
                name: row.author_name,
                username: row.author_username,
                avatarUrl: row.author_avatarUrl
            },
            isLiked: Number(row.is_liked) === 1,
            _count: {
                likes: Number(row.like_count),
                comments: Number(row.comment_count)
            },
            // Debug info (optional, remove in prod)
            debugScore: row.similarity_score
        }))

        // Cursor logic (for next batch) - we use an OFFSET approach or score-based?
        // Score-based is hard because score changes dynamically.
        // For MVP, typically "Offset" is safer unless we persist the feed.
        // Wait, infinite scroll with dynamic scores is tricky. 
        // Best approach for MVP: Use OFFSET based on page number passed via cursor?
        // Let's assume cursor is just "page number" for now since complex score-cursor is hard.
        // UPDATE: The user asked for "cursor" based on scrolling.
        // Let's implement OFFSET pagination for now: cursor = offset.

        // Actually, let's fix the SQL to use OFFSET.
        // We need to re-run the query with OFFSET.
        const offset = parseInt(searchParams.get('cursor') || '0');

        // (Re-writing the query execution to include OFFSET)
        const paginatedPosts = await prisma.$queryRaw`
            SELECT 
                p.id, 
                p."createdAt", 
                p.caption, 
                p.media, 
                p.type,
                p."authorId", 
                u.name as author_name, 
                u.username as "author_username", 
                u."avatarUrl" as "author_avatarUrl",
                COUNT(l.id) as like_count,
                COUNT(c.id) as comment_count,
                MAX(CASE WHEN l."userId" = ${user.id} THEN 1 ELSE 0 END) as is_liked,
                ${hasInterest

                ? Prisma.sql`(1 - (p.embedding <=> ${(userRecord as any).interestEmbedding}))`
                : Prisma.sql`0.5`} as similarity_score
            FROM "Post" p
            JOIN "User" u ON p."authorId" = u.id
            LEFT JOIN "Like" l ON p.id = l."postId"
            LEFT JOIN "Comment" c ON p.id = c."postId"
            WHERE p."authorId" != ${user.id}
            GROUP BY p.id, u.id
            ORDER BY 
                (
                    (
                        (${hasInterest ? Prisma.sql`(1 - (p.embedding <=> ${(userRecord as any).interestEmbedding}))` : Prisma.sql`0.5`} * 0.7) 
                        + 
                        ((LEAST(LOG(COUNT(l.id) + COUNT(c.id) + 1), 5) / 5) * 0.3)
                    ) 
                    * 
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM "Friendship" f 
                            WHERE (f."requesterId" = ${user.id} AND f."addresseeId" = p."authorId" AND f.status = 'ACCEPTED')
                            OR (f."addresseeId" = ${user.id} AND f."requesterId" = p."authorId" AND f.status = 'ACCEPTED')
                        ) THEN 1.75
                        ELSE 1.1
                    END
                ) DESC
            LIMIT ${limit} OFFSET ${offset}
        ` as any[]

        const finalizedPosts = paginatedPosts.map((row: any) => ({
            id: row.id,
            createdAt: row.createdAt,
            caption: row.caption,
            media: row.media,
            type: row.type,
            authorId: row.authorId,
            author: {
                id: row.authorId,
                name: row.author_name,
                username: row.author_username,
                avatarUrl: row.author_avatarUrl
            },
            isLiked: Number(row.is_liked) === 1,
            _count: {
                likes: Number(row.like_count),
                comments: Number(row.comment_count)
            }
        }))

        return NextResponse.json({
            posts: finalizedPosts,
            nextCursor: finalizedPosts.length === limit ? offset + limit : null
        })

    } catch (error) {
        console.error("Smart Feed error:", error)
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

            // Robust type detection
            if (file.type.startsWith('video/') || filename.endsWith('.mp4') || filename.endsWith('.mov')) {
                mediaType = 'VIDEO'
            }
        }

        if (file) {
            console.log(`[DEBUG] Uploaded file: name=${file.name}, type=${file.type}, size=${file.size}`);
        }

        // REMOVED synchronous AI generation to improve performance
        // let aiDescription = null
        // ... (moved to background)

        const post = await prisma.post.create({
            data: {
                caption: caption || '',
                authorId,
                groupId,
                media: mediaUrl,
                type: mediaType,
                aiDescription: null, // Will be updated asynchronously
            },
            include: {
                author: true
            }
        })

        // Notify Friends
        const friends = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: user.id },
                    { addresseeId: user.id }
                ],
                status: 'ACCEPTED'
            },
            include: {
                requester: { select: { id: true, pushToken: true } },
                addressee: { select: { id: true, pushToken: true } }
            }
        })


        // Get current user's push token to avoid self-notifications (e.g. same device testing)
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { pushToken: true }
        })

        const tokens: string[] = []
        friends.forEach(f => {
            const friend = f.requesterId === user.id ? f.addressee : f.requester
            if (friend.pushToken && friend.pushToken !== currentUser?.pushToken) {
                tokens.push(friend.pushToken)
            }
        })

        console.log(`[DEBUG] Found ${friends.length} friends for user ${user.id}`);
        console.log(`[DEBUG] Sending notifications to ${tokens.length} tokens`);

        if (tokens.length > 0) {
            await sendPushNotification(
                tokens,
                `New Post from ${user.name || user.username}`,
                `Check out what ${user.name || user.username} just posted!`,
                { postId: post.id }
            )
        }

        // --- Background AI Task ---
        (async () => {
            try {
                // Re-read file buffer for AI context
                // In production, you might pass the filepath to a worker
                let bgBuffer: Buffer | undefined;
                if (file) {
                    const bgBytes = await file.arrayBuffer();
                    bgBuffer = Buffer.from(bgBytes);
                }

                if (mediaType === 'IMAGE' && bgBuffer) {
                    console.log(`[Background] Starting AI description for IMAGE Post ${post.id}...`);
                    const { generateImageDescription, getEmbedding } = await import("@/lib/gemini");

                    const description = await generateImageDescription(bgBuffer, file!.type);
                    let finalText = caption || '';

                    if (description) {
                        await prisma.post.update({
                            where: { id: post.id },
                            data: { aiDescription: description }
                        });
                        console.log(`[Background] AI description updated for Post ${post.id}`);
                        finalText += " " + description;
                    }

                    // Generate Embedding
                    if (finalText.trim()) {
                        const vector = await getEmbedding(finalText.trim());
                        if (vector) {
                            const vectorString = `[${vector.join(',')}]`;
                            await prisma.$executeRaw`UPDATE "Post" SET embedding = ${vectorString}::vector WHERE id = ${post.id}`;
                        }
                    }
                } else if (mediaType === 'VIDEO' && bgBuffer) {
                    console.log(`[Background] Starting AI analysis for VIDEO Post ${post.id}...`);
                    const { analyzeVideo, getEmbedding } = await import("@/lib/gemini");
                    const description = await analyzeVideo(bgBuffer, file!.type);

                    let finalText = caption || '';

                    if (description) {
                        await prisma.post.update({
                            where: { id: post.id },
                            data: { aiDescription: description }
                        });
                        console.log(`[Background] AI description updated for VIDEO Post ${post.id}`);
                        finalText += " " + description;
                    }

                    // Generate Embedding
                    if (finalText.trim()) {
                        const vector = await getEmbedding(finalText.trim());
                        if (vector) {
                            const vectorString = `[${vector.join(',')}]`;
                            await prisma.$executeRaw`UPDATE "Post" SET embedding = ${vectorString}::vector WHERE id = ${post.id}`;
                            console.log(`[Background] Embedding generated and saved for VIDEO Post ${post.id}`);
                        }
                    }
                }

            } catch (bgError) {
                console.error(`[Background] AI Generation Failed for Post ${post.id}:`, bgError);
            }
        })();
        // --------------------------

        return NextResponse.json(post)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Error creating post' }, { status: 500 })
    }
}
