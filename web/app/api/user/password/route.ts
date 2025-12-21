import { getCurrentUser } from "@/lib/auth-unified"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PATCH(req: Request) {
    try {
        const user = await getCurrentUser(req)

        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { currentPassword, newPassword } = await req.json()

        if (!currentPassword || !newPassword) {
            return Response.json(
                { error: "Current and new password required" },
                { status: 400 }
            )
        }

        // Get fresh user data including password (which is excluded in getCurrentUser)
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id }
        })

        if (!dbUser || !dbUser.password) {
            // Should not happen for password users
            return Response.json({ error: "User not found" }, { status: 404 })
        }

        const isValid = await bcrypt.compare(currentPassword, dbUser.password)

        if (!isValid) {
            return Response.json({ error: "Incorrect current password" }, { status: 403 })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        })

        return Response.json({ message: "Password updated successfully" })

    } catch (error) {
        return Response.json({ error: "Failed to update password" }, { status: 500 })
    }
}
