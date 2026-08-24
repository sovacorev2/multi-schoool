'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FileText, LogOut, Settings } from 'lucide-react'

export function RequisitionHeader({ fullName }: { fullName: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/requisition/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/requisition" className="flex items-center gap-2 font-semibold text-primary">
          <FileText className="h-5 w-5" />
          ShuleTech Requisitions
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{fullName}</span>
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
