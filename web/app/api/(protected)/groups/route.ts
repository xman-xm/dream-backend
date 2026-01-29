import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { getEmbedding } from "@/lib/gemini"

export async function POST(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("User authorized for group creation:", user.id)

    try {
        const formData = await request.formData()
        const name = formData.get('name') as string
        const description = formData.get('description') as string | null
        const file = formData.get('avatar') as File | null

        if (!name) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
        }

        let avatarUrl = null

        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
            const filename = `group-${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`
            const uploadDir = join(process.cwd(), 'storage')

            // Ensure directory exists
            await mkdir(uploadDir, { recursive: true })

            const filepath = join(uploadDir, filename)
            await writeFile(filepath, buffer)
            avatarUrl = `/api/storage/${filename}`
        }

        const group = await prisma.group.create({
            data: {
                name,
                description: description || '',
                avatarUrl,
                creatorId: user.id,
                members: {
                    create: {
                        userId: user.id,
                        role: 'ADMIN' // Creator is Admin
                    }
                }
            }
        })

        // Generate and store embedding asynchronously
        const embeddingText = `${name} ${description || ''}`.trim();
        (async () => {
            try {
                const vector = await getEmbedding(embeddingText);
                if (vector) {
                    const vectorString = `[${vector.join(',')}]`;
                    await prisma.$executeRaw`UPDATE "Group" SET embedding = ${vectorString}::vector WHERE id = ${group.id}`;
                    console.log(`[Background] Embedding generated for Group ${group.id}`);
                }
            } catch (err) {
                console.error(`[Background] Failed to generate embedding for Group ${group.id}:`, err);
            }
        })();

        return NextResponse.json(group)

    } catch (error) {
        // Detailed error logging
        console.error("Error creating group:", error)
        if (error instanceof Error) {
            console.error(error.stack)
        }
        return NextResponse.json({
            error: 'Error creating group',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
