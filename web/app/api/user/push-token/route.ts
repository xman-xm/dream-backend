import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth-unified"

export async function POST(request: Request) {
    const user = await getCurrentUser(request)

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { token } = await request.json()

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 })
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { pushToken: token }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error saving push token:", error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
