import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
    try {
        const user = await getCurrentUser(req)

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { name, bio, avatarUrl, username } = await req.json()

        // Check username uniqueness if changing
        if (username && username !== user.username) {
            const existing = await prisma.user.findUnique({
                where: { username }
            })
            if (existing) {
                return Response.json({ error: "Username taken" }, { status: 409 })
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                name: name ?? undefined,
                bio: bio ?? undefined,
                avatarUrl: avatarUrl ?? undefined,
                username: username ?? undefined,
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
        return Response.json({ error: "Failed to update profile" }, { status: 500 })
    }
}
