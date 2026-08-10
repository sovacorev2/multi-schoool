'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Phone } from 'lucide-react'

const SUPPORT_EMAIL = 'admin@shuletechsolutions.co.ke'
const SUPPORT_PHONE_DISPLAY = '0756288563'
const SUPPORT_PHONE_TEL = '+254756288563'

export function SchoolLockedScreen({
  school,
  variant = 'public',
}: {
  school: { name: string; code?: string; logo_url?: string | null; primary_color?: string | null }
  variant?: 'public' | 'admin'
}) {
  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `Reactivate ${school.name}${school.code ? ` (${school.code})` : ''}`
  )}&body=${encodeURIComponent(`Hello ShuleTech,\n\nWe would like to reactivate access for ${school.name}.\n\n`)}`

  return (
    <div className="min-h-screen bg-background dark:bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg bg-card dark:bg-card border-border dark:border-border">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center mb-4">
            {school.logo_url ? (
              <img
                src={school.logo_url}
                alt={`${school.name} logo`}
                className="w-20 h-20 object-contain opacity-60"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl opacity-60"
                style={{ backgroundColor: school.primary_color || '#2563eb' }}
              >
                {school.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold mb-2 text-foreground dark:text-foreground break-words">{school.name}</CardTitle>
            <CardDescription className="text-base text-muted-foreground dark:text-muted-foreground">
              Access Temporarily Unavailable
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            This school&apos;s ShuleTech account needs to be renewed before it can be accessed again.
          </p>
          {variant === 'admin' ? (
            <>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                As the school admin, you can reach out to ShuleTech directly to sort out payment and get access restored.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="w-full">
                  <a href={mailtoHref}>
                    <Mail className="w-4 h-4 mr-2 shrink-0" />
                    Email ShuleTech
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={`tel:${SUPPORT_PHONE_TEL}`}>
                    <Phone className="w-4 h-4 mr-2 shrink-0" />
                    Call {SUPPORT_PHONE_DISPLAY}
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground break-all">{SUPPORT_EMAIL}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              Please contact your school administrator, or reach out to ShuleTech support to complete payment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
