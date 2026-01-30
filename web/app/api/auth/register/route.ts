import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"

export async function POST(req: Request) {
    try {
        const { email, password, username, name } = await req.json()

        if (!email || !password || !username) {
            return Response.json(
                { error: "Missing required fields" },
                { status: 400 }
            )
        }

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            }
        })

        if (existingUser) {
            return Response.json(
                { error: "User with this email or username already exists" },
                { status: 409 }
            )
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                username,
                name,
                password: hashedPassword
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

        // Generate token for mobile clients (so they can auto-login)
        if (!process.env.NEXTAUTH_SECRET) {
            throw new Error("NEXTAUTH_SECRET is not defined")
        }
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)
        const token = await new SignJWT({
            userId: user.id,
            email: user.email
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret)

        return Response.json({
            message: "User created successfully",
            user: { ...user, _count: { posts: 0, friends: 0 } },
            token
        }, { status: 201 })

    } catch (error) {
        console.error("Registration error:", error)
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
