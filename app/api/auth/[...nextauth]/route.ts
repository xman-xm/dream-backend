import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { validateCredentials } from "@/lib/auth"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt"
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                return await validateCredentials(
                    credentials?.email,
                    credentials?.password
                )
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                // Manually add id to session user from token
                // @ts-ignore
                session.user.id = token.sub
            }
            return session
        },
        async jwt({ token, user }) {
            return token
        }
    },
    pages: {
        signIn: '/auth/signin',
    },
    logger: {
        error(code, metadata) {
            if (code === 'JWT_SESSION_ERROR') return;
            console.error(code, metadata);
        }
    }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
