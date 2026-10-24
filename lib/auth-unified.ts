import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/prisma"

/**
 * Retrieves the currently authenticated user from either:
 * 1. A NextAuth session (cookies)
 * 2. A JWT Bearer token (API headers)
 */
export async function getCurrentUser(req?: Request) {
    // 1. Try getting NextAuth session (Web)
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.email) {
            return await prisma.user.findUnique({
                where: { email: session.user.email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    username: true,
                    avatarUrl: true,
                    bio: true,
                    createdAt: true,
                }
            })
        }
    } catch (sessionErr) {
        // NextAuth session token expired or invalid secret, ignore silently
    }

    // 2. Try getting Bearer Token (Mobile)
    if (req) {
        const authHeader = req.headers.get("Authorization")
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1]
            try {
                // console.log("Verifying token:", token.substring(0, 10) + "...")
                const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
                const { payload } = await jwtVerify(token, secret)
                // console.log("Token payload:", payload)

                if (payload.userId) {
                    return await prisma.user.findUnique({
                        where: { id: payload.userId as string },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            username: true,
                            avatarUrl: true,
                            bio: true,
                            createdAt: true,
                        }
                    })
                }
            } catch (error) {
                // Token invalid or expired
                return null
            }
        }
    }

    return null
}
