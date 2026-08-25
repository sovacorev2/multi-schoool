'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Settings } from 'lucide-react'

export function RequisitionHeader({ fullName }: { fullName: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/requisition/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-border bg-card shadow-sm no-print">
      <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/requisition" className="flex items-center gap-2.5">
          <Image src="/icon-512.png" alt="STEMS" width={38} height={38} priority />
          <div className="leading-tight">
            <p className="font-bold tracking-wide text-primary">STEMS</p>
            <p className="text-xs text-muted-foreground">Requisitions</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{fullName}</span>
          <Link href="/requisition/account">
            <Button variant="ghost" size="icon" title="Account settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </div>
    </nav>
  )
}
