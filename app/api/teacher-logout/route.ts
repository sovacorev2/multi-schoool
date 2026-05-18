import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('teacher_session')

    return Response.json({ success: true })
  } catch (error) {
    console.error('[v0] Logout error:', error)
    return Response.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}
