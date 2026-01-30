import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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
        // Check if userId query parameter is provided
        const { searchParams } = new URL(request.url)
        const userIdFilter = searchParams.get('userId')

        let whereCondition: any = {}

        // If userId is provided, fetch posts for that specific user
        if (userIdFilter) {
            whereCondition = {
                authorId: userIdFilter
            }
        } else {
            // Otherwise, use the friends feed algorithm
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
