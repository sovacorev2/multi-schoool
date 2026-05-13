import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.AFRICAS_TALKING_API_KEY
    const username = process.env.AFRICAS_TALKING_USERNAME

    if (!apiKey || !username) {
      return NextResponse.json(
        { error: 'Africa\'s Talking credentials not configured' },
        { status: 500 }
      )
    }

    // Get balance from Africa's Talking (LIVE API)
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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Africa\'s Talking API error:', response.status, errorText)
      return NextResponse.json(
        { balance: 0, error: 'Failed to fetch balance' },
        { status: 200 }
      )
    }

    const data = await response.json()
    console.log('[v0] Africa\'s Talking response:', JSON.stringify(data, null, 2))
    
    // Handle different response formats
    let balance = 0
    if (data.UserData?.balance) {
      const balanceStr = String(data.UserData.balance)
      // Remove "KES " prefix if present and parse the number
      balance = parseFloat(balanceStr.replace('KES ', '').trim())
    }

    console.log('[v0] Parsed balance:', balance)

    return NextResponse.json({
      success: true,
      balance: balance || 0
    })
  } catch (error) {
    console.error('[v0] Error getting Africa\'s Talking balance:', error)
    return NextResponse.json(
      { balance: 0, error: 'Error fetching balance' },
      { status: 200 }
    )
  }
}
