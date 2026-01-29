
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyEmbeddings() {
    console.log("Verifying Gemini Embeddings...");

    // Debug API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        console.log(`API Key found: ${apiKey.substring(0, 5)}...`);
    } else {
        console.error("❌ API Key NOT found in process.env");
        return;
    }

    // Dynamic import to ensure env vars are loaded
    const { getEmbedding } = await import('../lib/gemini');

    const testText = "Social media app for friends and groups";

    console.log(`Generating embedding for: "${testText}"`);
    try {
        const embedding = await getEmbedding(testText);

        if (embedding) {
            console.log("✅ Success! Embedding generated.");
            console.log(`Vector length: ${embedding.length}`);
            console.log(`First 5 values: ${embedding.slice(0, 5)}...`);
        } else {
            console.error("❌ Failed to generate embedding (returned null).");
        }
    } catch (e) {
        console.error("❌ Exception during test:", e);
    }
}

verifyEmbeddings();
