'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RequisitionLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      // Only mask the specific "wrong credentials" case - anything else
      // (rate limiting, network issues, etc.) shows the real message so a
      // login problem isn't indistinguishable from a typo'd password.
      setError(error.message.toLowerCase().includes('invalid login credentials') ? 'Invalid email or password.' : error.message)
      setIsLoading(false)
      return
    }

    // Read the redirect target directly from the URL instead of
    // useSearchParams() - avoids needing a Suspense boundary around this
    // page, which this Next.js version's Turbopack SSR streaming doesn't
    // reliably resolve on the very first navigation.
    const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null
    router.push(next || '/requisition')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary via-primary to-secondary/10 bg-[length:100%_240px] bg-no-repeat p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <Image src="/icon-512.png" alt="STEMS" width={72} height={72} className="mx-auto mb-2" priority />
          <CardTitle className="tracking-wide">STEMS Requisitions</CardTitle>
          <CardDescription>Sign in with your ShuleTech email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shuletechsolutions.co.ke" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
