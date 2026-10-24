import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"
import { writeFile } from "fs/promises"
import { join } from "path"

export async function PATCH(req: Request) {
    try {
        const user = await getCurrentUser(req)

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const formData = await req.formData()
        const name = formData.get("name") as string | null
        const bio = formData.get("bio") as string | null
        const username = formData.get("username") as string | null
        const file = formData.get("image") as File | null

        // Check username uniqueness if changing
        if (username && username !== user.username) {
            const existing = await prisma.user.findUnique({
                where: { username }
            })
            if (existing) {
                return Response.json({ error: "Username taken" }, { status: 409 })
            }
        }

        let avatarUrl = undefined
        if (file) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)

            // Ensure unique filename
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
            const filename = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

            // Save to secure storage
            const uploadDir = join(process.cwd(), 'storage')
            const filepath = join(uploadDir, filename)

            await writeFile(filepath, buffer)

            // Set secure API URL
            avatarUrl = `/api/storage/${filename}`
        }

        // Generate embedding if bio is changing
        if (bio && bio !== user.bio) {
            try {
                const { getEmbedding } = await import("@/lib/gemini");
                const vector = await getEmbedding(bio);

                if (vector) {
                    const vectorString = `[${vector.join(',')}]`;

                    // initialize interestEmbedding if null (Cold Start)
                    await prisma.$executeRaw`
                        UPDATE "User" 
                        SET "interestEmbedding" = ${vectorString}::vector 
                        WHERE id = ${user.id} AND "interestEmbedding" IS NULL
                     `;

                    // Also update the static 'embedding' column
                    await prisma.$executeRaw`
                        UPDATE "User" 
                        SET "embedding" = ${vectorString}::vector 
                        WHERE id = ${user.id}
                     `;
                }
            } catch (e) {
                console.error("Error generating bio embedding:", e);
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: name ?? undefined,
                bio: bio ?? undefined,
                username: username ?? undefined,
                avatarUrl: avatarUrl, // Will be undefined if not updated
            },
            select: {
                id: true,
                email: true,
                name: true,
                username: true,
                avatarUrl: true,
                bio: true
            }
        })

        return Response.json({ user: updatedUser })

    } catch (error) {
        console.error("Profile update error:", error)
        return Response.json({ error: "Failed to update profile" }, { status: 500 })
    }
}
