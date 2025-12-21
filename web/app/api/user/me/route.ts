import { getCurrentUser } from "@/lib/auth-unified"

export async function GET(req: Request) {
    const user = await getCurrentUser(req)

    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    return Response.json({ user })
}
