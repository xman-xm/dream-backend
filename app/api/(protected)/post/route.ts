import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth-unified"
import { writeFile } from "fs/promises"
import { join } from "path"

export async function GET(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const userIdFilter = searchParams.get('userId')

        // 1. Profile Mode (Chronological)
        if (userIdFilter) {
            const cursor = parseInt(searchParams.get('cursor') || '0');
            const limit = 20;

            const posts = await prisma.post.findMany({
                where: { authorId: userIdFilter },
                orderBy: { createdAt: 'desc' },
                include: {
                    author: true,
                    likes: { where: { userId: user.id } },
                    comments: { where: { authorId: user.id } },
                    _count: { select: { likes: true, comments: true } }
                },
                take: limit,
                skip: cursor
            })

            const enhancedPosts = posts.map(post => ({
                ...post,
                isLiked: (post as any).likes.length > 0,
                isCommented: (post as any).comments.length > 0
            }))

            return NextResponse.json({
                posts: enhancedPosts,
                nextCursor: posts.length === limit ? cursor + limit : null
            })
        }

        // 2. Smart Feed Mode with Video Promotion

        // Parse Cursor: Expects JSON string { i: number, v: number } or fallback to simple offset (0)
        let cursor = { i: 0, v: 0 };
        const cursorParam = searchParams.get('cursor');
        if (cursorParam) {
            try {
                if (cursorParam.startsWith('{')) {
                    // New format
                    cursor = JSON.parse(cursorParam);
                } else {
                    // Legacy or simple number fallback
                    const val = parseInt(cursorParam);
                    if (!isNaN(val)) {
                        cursor = { i: val, v: val };
                    }
                }
            } catch (e) {
                console.warn("Invalid cursor format, resetting", cursorParam);
            }
        }

        // Get User's Interest Vector
        const userResult = await prisma.$queryRaw`
            SELECT "interestEmbedding" FROM "User" WHERE id = ${user.id}
        ` as any[]
        const userRecord = userResult[0] || null
        const hasInterest = !!(userRecord as any)?.interestEmbedding

        // Helper to fetch posts by type
        const fetchPostsByType = async (type: 'IMAGE' | 'VIDEO', offset: number, limit: number) => {
            return await prisma.$queryRaw`
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
                    MAX(CASE WHEN c."authorId" = ${user.id} THEN 1 ELSE 0 END) as is_commented,
                    ${hasInterest
                    ? Prisma.sql`(1 - (p.embedding <=> ${(userRecord as any).interestEmbedding}))`
                    : Prisma.sql`0.5`} as similarity_score
                FROM "Post" p
                JOIN "User" u ON p."authorId" = u.id
                LEFT JOIN "Like" l ON p.id = l."postId"
                LEFT JOIN "Comment" c ON p.id = c."postId"
                WHERE (
                    p."authorId" = ${user.id}
                    OR EXISTS (
                        SELECT 1 FROM "Follow" f
                        WHERE f."followerId" = ${user.id} AND f."followingId" = p."authorId"
                    )
                )
                AND p.type = ${type}
                GROUP BY p.id, u.id
                ORDER BY 
                    (
                        (
                            (${hasInterest ? Prisma.sql`(1 - (p.embedding <=> ${(userRecord as any).interestEmbedding}))` : Prisma.sql`0.5`} * 0.7) 
                            + 
                            ((LEAST(LOG(COUNT(l.id) + COUNT(c.id) + 1), 5) / 5) * 0.3)
                        ) 
                        * 
                        CASE WHEN p."authorId" = ${user.id} THEN 1.25 ELSE 1.0 END
                    ) DESC
                LIMIT ${limit} OFFSET ${offset}
            ` as any[];
        };

        // We fetch enough items to fill the slots.
        // Pattern: Img, Img, Any, Vid, Vid (Total 5)
        // Img needs max 3 (if "Any" is best filled by Img)
        // Vid needs max 3 (if "Any" is best filled by Vid)
        // We fetch 4 just to be safe.
        const [imagePostsRaw, videoPostsRaw] = await Promise.all([
            fetchPostsByType('IMAGE', cursor.i, 4),
            fetchPostsByType('VIDEO', cursor.v, 4)
        ]);

        const formatPost = (row: any) => ({
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
            isCommented: Number(row.is_commented) === 1,
            _count: {
                likes: Number(row.like_count),
                comments: Number(row.comment_count)
            },
            debugScore: row.similarity_score
        });

        const imagePosts = imagePostsRaw.map(formatPost);
        const videoPosts = videoPostsRaw.map(formatPost);

        const resultPosts: any[] = [];
        let iPtr = 0;
        let vPtr = 0;

        // Slot 1: Image
        if (iPtr < imagePosts.length) resultPosts.push(imagePosts[iPtr++]);

        // Slot 2: Image
        if (iPtr < imagePosts.length) resultPosts.push(imagePosts[iPtr++]);

        // Slot 3: Image or Video (Higher Score Wins)
        if (iPtr < imagePosts.length && vPtr < videoPosts.length) {
            const imgScore = imagePosts[iPtr].debugScore || 0;
            const vidScore = videoPosts[vPtr].debugScore || 0;
            if (imgScore >= vidScore) {
                resultPosts.push(imagePosts[iPtr++]);
            } else {
                resultPosts.push(videoPosts[vPtr++]);
            }
        } else if (iPtr < imagePosts.length) {
            resultPosts.push(imagePosts[iPtr++]);
        } else if (vPtr < videoPosts.length) {
            resultPosts.push(videoPosts[vPtr++]);
        }

        // Slot 4: Video
        if (vPtr < videoPosts.length) resultPosts.push(videoPosts[vPtr++]);

        // Slot 5: Video
        if (vPtr < videoPosts.length) resultPosts.push(videoPosts[vPtr++]);

        // Fallback: If slots not filled (e.g. out of videos), fill with remaining images
        while (resultPosts.length < 5 && iPtr < imagePosts.length) {
            resultPosts.push(imagePosts[iPtr++]);
        }
        // Or if out of images, fill with videos (less likely given the prompt, but good for robustness)
        while (resultPosts.length < 5 && vPtr < videoPosts.length) {
            resultPosts.push(videoPosts[vPtr++]);
        }

        // Next Cursor
        const nextCursorObj = {
            i: cursor.i + iPtr,
            v: cursor.v + vPtr
        };

        const nextCursor = resultPosts.length > 0 ? JSON.stringify(nextCursorObj) : null;

        return NextResponse.json({
            posts: resultPosts,
            nextCursor
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
        const file = formData.get('image') as File | null

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
                authorId: user.id,
                groupId: null,
                media: mediaUrl,
                type: mediaType,
                aiDescription: null, // Will be updated asynchronously
            },
            include: {
                author: true
            }
        })

        if (mediaType === 'VIDEO') {
            const followers = await prisma.follow.findMany({
                where: { followingId: user.id },
                select: { followerId: true },
            });
            if (followers.length) {
            const { createNotifications } = await import("@/lib/notification-service");
            try {
                await createNotifications(followers.map(({ followerId }) => ({
                    recipientId: followerId,
                    actorId: user.id,
                    type: "NEW_POST" as const,
                    message: "posted a new video.",
                    postId: post.id,
                })));
            } catch (notificationError) {
                console.error("Unable to save upload notifications:", notificationError);
            }
            }
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
