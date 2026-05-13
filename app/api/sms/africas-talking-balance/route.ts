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

    // Get balance from Africa's Talking
    const response = await fetch(
      `https://api.sandbox.africastalking.com/version1/user?username=${username}`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    )

    if (!response.ok) {
      console.error('[v0] Africa\'s Talking API error:', response.status)
      return NextResponse.json(
        { balance: 0, error: 'Failed to fetch balance' },
        { status: 200 }
      )
    }

    const data = await response.json()
    const balance = data.UserData?.balance || 0

    return NextResponse.json({
      success: true,
      balance: parseFloat(balance.replace('KES ', ''))
    })
  } catch (error) {
    console.error('[v0] Error getting Africa\'s Talking balance:', error)
    return NextResponse.json(
      { balance: 0, error: 'Error fetching balance' },
      { status: 200 }
    )
  }
}
