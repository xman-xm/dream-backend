require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString, ssl: true })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    try {
        // 1. Create User
        const email = `testuser_${Date.now()}@example.com`
        const user = await prisma.user.create({
            data: {
                email,
                username: `user_${Date.now()}`,
                name: 'Test User'
            }
        })
        console.log('Created user:', user.id)

        // 2. Call API
        const response = await fetch('http://localhost:3000/api/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caption: 'Hello World from API Test',
                authorId: user.id,
                media: [
                    { url: 'https://example.com/image.jpg', type: 'IMAGE' }
                ]
            })
        })

        const data = await response.json()
        console.log('API Response:', JSON.stringify(data, null, 2))
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
