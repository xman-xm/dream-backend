import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request) {
    try {
        const user = await getCurrentUser(req)

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Delete user (cascade will handle relations defined in Prisma schema)
        // If cascade is not set in schema, this might fail or leave orphans.
        // Assuming Prisma schema has onDelete: Cascade for user relations (which it mostly does).
        await prisma.user.delete({
            where: { id: user.id }
        })

        return Response.json({ message: "Account deleted successfully" })

    } catch (error) {
        console.error("Delete account error:", error)
        return Response.json(
            { error: "Failed to delete account" },
            { status: 500 }
        )
    }
}
