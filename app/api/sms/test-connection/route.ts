import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[v0] Testing Africa\'s Talking connection...')
    
    const apiKey = process.env.AFRICAS_TALKING_API_KEY
    const username = process.env.AFRICAS_TALKING_USERNAME

    console.log('[v0] API Key present:', !!apiKey)
    console.log('[v0] Username:', username)
    console.log('[v0] API Key starts with:', apiKey?.substring(0, 10))

    if (!apiKey || !username) {
      return NextResponse.json({
        error: 'Missing credentials',
        hasApiKey: !!apiKey,
        hasUsername: !!username
      }, { status: 400 })
    }

    // Test the Africa's Talking API
    const response = await fetch(
      `https://api.africastalking.com/version1/user?username=${username}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    console.log('[v0] Africa\'s Talking response status:', response.status)
    const data = await response.json()
    console.log('[v0] Africa\'s Talking response:', JSON.stringify(data, null, 2))

    return NextResponse.json({
      status: response.status,
      data: data,
      success: response.ok
    })
  } catch (error) {
    console.error('[v0] Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
