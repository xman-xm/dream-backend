async function main() {
    try {
        const response = await fetch('http://localhost:3000/api/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Empty body to trigger JSON parse error or empty body handling
        })

        console.log('Status:', response.status)
        const data = await response.json()
        console.log('Response:', data)
    } catch (e) {
        console.error(e)
    }
}

main()
