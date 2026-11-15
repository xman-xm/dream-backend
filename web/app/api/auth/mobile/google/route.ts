import { prisma } from "@/lib/prisma";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const publicUserFields = {
  id: true,
  email: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
} as const;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400, headers: corsHeaders });
  }

  if (typeof idToken !== "string" || idToken.length > 10_000) {
    return Response.json({ error: "A valid Google credential is required." }, { status: 400, headers: corsHeaders });
  }

  const audience = process.env.GOOGLE_WEB_CLIENT_ID;
  const sessionSecret = process.env.NEXTAUTH_SECRET;
  if (!audience || !sessionSecret) {
    console.error("Google mobile sign-in is missing server configuration.");
    return Response.json({ error: "Google sign-in is temporarily unavailable." }, { status: 503, headers: corsHeaders });
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, {
      audience,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    }));
  } catch {
    return Response.json({ error: "Google sign-in could not be verified." }, { status: 401, headers: corsHeaders });
  }

  const subject = payload.sub;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!subject || !email || payload.email_verified !== true) {
    return Response.json({ error: "Use a Google account with a verified email address." }, { status: 401, headers: corsHeaders });
  }

  try {
    const displayName = typeof payload.name === "string" ? payload.name.slice(0, 100) : null;
    const avatarUrl = typeof payload.picture === "string" ? payload.picture : null;
    const emailPrefix = email.split("@")[0] || "creator";
    const usernamePrefix = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "creator";
    const username = `${usernamePrefix}_${subject.slice(-8).toLowerCase()}`;

    let user = await prisma.$transaction(async (transaction) => {
      const linkedAccount = await transaction.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: subject,
          },
        },
        select: { user: { select: publicUserFields } },
      });
      if (linkedAccount) return linkedAccount.user;

      const existingUser = await transaction.user.findUnique({
        where: { email },
        select: publicUserFields,
      });
      if (existingUser) {
        await transaction.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: subject,
          },
        });
        return existingUser;
      }

      return transaction.user.create({
        data: {
          email,
          username,
          name: displayName,
          avatarUrl,
          accounts: {
            create: {
              type: "oauth",
              provider: "google",
              providerAccountId: subject,
            },
          },
        },
        select: publicUserFields,
      });
    });

    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(sessionSecret));

    return Response.json(
      { token, user: { ...user, _count: { posts: 0, followers: 0, following: 0 } } },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Google mobile account exchange failed:", error);
    return Response.json({ error: "Google sign-in could not be completed." }, { status: 500, headers: corsHeaders });
  }
}