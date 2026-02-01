
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client"
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { getEmbedding } from "../lib/gemini"
import fs from "fs"
import path from "path"
import https from "https"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Prisma
console.log("DB URL:", process.env.DATABASE_URL ? "Defined" : "Undefined");
console.log("Gemini Key:", process.env.GEMINI_API_KEY ? "Defined" : "Undefined");

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const VIDEO_DIR = path.join(process.cwd(), 'storage', 'videos')
const IMAGE_DIR = path.join(process.cwd(), 'storage')

// Ensure directories exist
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true })
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true })

// Helper to download file (using native fetch for redirects)
async function downloadFile(url: string, dest: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
}

// Helper to generate captions batch
async function generateCaptionsBatch(count: number): Promise<{ caption: string, type: 'IMAGE' | 'VIDEO', topic: string }[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
        Generate ${count} diverse and engaging social media captions JSON format.
        Each item should have:
        1. "caption": A short, catchy caption (max 20 words).
        2. "type": RANDOMLY choose "IMAGE" (80% chance) or "VIDEO" (20% chance).
        3. "topic": A single keyword to search for this content on Unsplash/Pexels (e.g. "sunset", "tech", "cat", "city").

        Return ONLY a JSON array.
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Cleanup markdown if present
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(jsonStr)
}

// Helper to sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Robust retry wrapper
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 5, baseDelay = 10000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries === 0) throw error;

        console.warn(`   ⚠️ Error: ${error.message} (Status: ${error.status})`);

        // Check for 429 or 503
        if (error.status === 429 || error.message?.includes('429') || error.status === 503) {
            console.warn(`   ⚠️ Rate limit hit. Retrying in ${baseDelay / 1000}s... (${retries} retries left)`);
            await sleep(baseDelay);
            return retryWithBackoff(fn, retries - 1, baseDelay * 2); // Exponential backoff
        }
        throw error;
    }
}

async function main() {
    console.log("🚀 Starting Seeding Process...")

    // 1. Fetch Users
    const users = await prisma.user.findMany({ select: { id: true, username: true } })
    if (users.length === 0) {
        console.error("❌ No users found! Please create some users first.")
        process.exit(1)
    }
    console.log(`✅ Found ${users.length} users.`)

    const TOTAL_POSTS = 500
    const BATCH_SIZE = 10

    // Cooldown start
    console.log("⏳ Waiting 5s for startup...")
    await sleep(5000);

    for (let i = 0; i < TOTAL_POSTS; i += BATCH_SIZE) {
        console.log(`\n📦 Processing Batch ${i / BATCH_SIZE + 1} (${i} - ${i + BATCH_SIZE})...`)

        try {
            // 2. Generate Content Ideas
            console.log("   ✨ Generating captions...")

            // WRAP IN RETRY
            const contents = await retryWithBackoff(() => generateCaptionsBatch(BATCH_SIZE));

            // Wait a bit after generation
            await sleep(5000);

            // 3. Process each post SEQUENTIALLY to avoid Rate Limit (15 RPM)
            // Or chunks of 3-5? Let's do sequential to be safe.
            for (const [idx, content] of contents.entries()) {
                const user = users[Math.floor(Math.random() * users.length)]
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`

                let filename = ''
                let mediaUrl = ''

                try {
                    // 4. Download Asset
                    if (content.type === 'IMAGE') {
                        filename = `seed-img-${uniqueSuffix}.jpg`
                        const dest = path.join(IMAGE_DIR, filename)
                        // Unsplash Source URL
                        const url = `https://source.unsplash.com/random/800x800/?${content.topic}`
                        // Note: source.unsplash is deprecated/unreliable sometimes, let's use lorem picsum fallback if fails?
                        // Actually picsum is safer: https://picsum.photos/seed/{seed}/800/800
                        const safeUrl = `https://picsum.photos/seed/${uniqueSuffix}/800/800`

                        await downloadFile(safeUrl, dest)
                        mediaUrl = `/api/storage/${filename}`

                    } else {
                        filename = `seed-vid-${uniqueSuffix}.mp4`
                        // Using a reliable sample video source since Pexels API requires key
                        // Provide a few hardcoded sample video URLs or use a placeholder
                        // For this script, let's stick to images for reliability or use a sample
                        const sampleVideos = [
                            "https://www.w3schools.com/html/mov_bbb.mp4",
                            "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
                        ]
                        const vidUrl = sampleVideos[Math.floor(Math.random() * sampleVideos.length)]

                        // We won't actually download gigabytes of video for a seed script unless requested.
                        // Let's just LINK to external for video to save space? 
                        // User asked to "download videos from internet". Okay.
                        const dest = path.join(VIDEO_DIR, filename)
                        // Only download video if it doesn't exist to save bandwidth on repeated runs?
                        // Actually let's just download it
                        await downloadFile(vidUrl, dest)
                        // Fix path for video storage logic
                        mediaUrl = `/api/storage/videos/${filename}`
                    }

                    // 5. Generate Embedding
                    // Rate limit: 1 request every 4 seconds = 15 RPM.
                    // Let's safe-guard with 2 seconds delay + retry logic in lib usually?
                    // We'll just wait here.
                    await sleep(4000);

                    // WRAP IN RETRY
                    const vector = await retryWithBackoff(() => getEmbedding(content.caption)).catch(err => {
                        console.error("   ⚠️ Embedding failed after retries, skipping vector.");
                        return null;
                    });

                    let embeddingSql = Prisma.sql`NULL`

                    // 6. DB Insert
                    // Note: We need raw insert for vector
                    if (vector) {
                        const vectorString = `[${vector.join(',')}]`
                        await prisma.$executeRaw`
                            INSERT INTO "Post" (
                                "id", "createdAt", "updatedAt", "caption", "media", "type", "authorId", "embedding", "aiDescription"
                            ) VALUES (
                                ${'seed-' + uniqueSuffix}, 
                                NOW(), 
                                NOW(), 
                                ${content.caption}, 
                                ${mediaUrl}, 
                                ${content.type}, 
                                ${user.id}, 
                                ${vectorString}::vector, 
                                ${"AI Generated: " + content.topic}
                            );
                        `
                    } else {
                        await prisma.post.create({
                            data: {
                                id: 'seed-' + uniqueSuffix,
                                caption: content.caption,
                                media: mediaUrl,
                                type: content.type,
                                authorId: user.id,
                                aiDescription: "AI Generated: " + content.topic
                            }
                        })
                    }

                    process.stdout.write(".")

                } catch (err) {
                    console.error(`\n   ❌ Failed post ${idx}:`, err)
                }
            }

        } catch (batchErr) {
            console.error("\n   ❌ Batch failed. Waiting 60s before retry...", batchErr)
            await sleep(60000)
            // Decrement i to retry this batch? 
            // Better to just skip for now to avoid infinite loop on bad prompt
        }
    }

    console.log("\n\n✅ Seeding Complete!")
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
