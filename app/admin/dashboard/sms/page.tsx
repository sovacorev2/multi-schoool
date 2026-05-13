'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, RefreshCw, Send, TrendingDown, History, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Bundle {
  id: string
  sms_count: number
  price_ksh: number
  description?: string
}

interface SMSBalance {
  available_credits: number
  total_purchased: number
  total_used: number
}

export default function SchoolSMSPage() {
  const [activeTab, setActiveTab] = useState('balance')
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<SMSBalance>({
    available_credits: 0,
    total_purchased: 0,
    total_used: 0
  })
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [requestingBundle, setRequestingBundle] = useState(false)
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadSchoolSMSData()
  }, [])

  const loadSchoolSMSData = async () => {
    try {
      setLoading(true)

      // Get school info
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error('[v0] Error getting user:', userError)
        return
      }

      // Get school ID from user metadata or table
      const { data: adminData } = await supabase
        .from('school_admins')
        .select('school_id')
        .eq('user_id', user.id)
        .single()

      if (!adminData?.school_id) {
        console.error('[v0] No school found for admin')
        return
      }

      const schoolId = adminData.school_id

      // Load balance
      const { data: balanceData } = await supabase
        .from('school_sms_credits')
        .select('*')
        .eq('school_id', schoolId)
        .single()

      if (balanceData) {
        setBalance(balanceData)
      }

      // Load bundles
      const { data: bundlesData } = await supabase
        .from('sms_bundles')
        .select('*')
        .order('sms_count')

      if (bundlesData) {
        setBundles(bundlesData)
      }

      // Load transactions
      const { data: transData } = await supabase
        .from('sms_transactions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (transData) {
        setTransactions(transData)
      }

      // Load usage history
      const { data: usageData } = await supabase
        .from('sms_usage_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (usageData) {
        setUsageHistory(usageData)
      }
    } catch (error) {
      console.error('[v0] Error loading SMS data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestBundle = async (bundleId: string) => {
    try {
      setRequestingBundle(true)

      const {
        data: { user }
      } = await supabase.auth.getUser()

      const { data: adminData } = await supabase
        .from('school_admins')
        .select('school_id')
        .eq('user_id', user?.id)
        .single()

      if (!adminData?.school_id) return

      // Get bundle details
      const bundle = bundles.find((b) => b.id === bundleId)
      if (!bundle) return

      // Create transaction request
      const { error } = await supabase.from('sms_transactions').insert({
        school_id: adminData.school_id,
        bundle_id: bundleId,
        sms_count: bundle.sms_count,
        price_ksh: bundle.price_ksh,
        status: 'pending'
      })

      if (error) throw error

      alert(`Bundle request sent! ${bundle.sms_count} SMS @ KES ${bundle.price_ksh}`)
      setSelectedBundle(null)
      loadSchoolSMSData()
    } catch (error) {
      console.error('[v0] Error requesting bundle:', error)
      alert('Failed to request bundle')
    } finally {
      setRequestingBundle(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <MessageSquare className="w-12 h-12 mx-auto text-blue-500 animate-pulse" />
          <p className="text-gray-600">Loading SMS information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Communications</h1>
          <p className="text-gray-600 mt-1">Manage SMS balance and send communications</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadSchoolSMSData}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-900">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{balance.available_credits}</div>
            <p className="text-xs text-blue-700 mt-2">SMS messages available</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900">Total Purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{balance.total_purchased}</div>
            <p className="text-xs text-green-700 mt-2">SMS bought to date</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-900">Total Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{balance.total_used}</div>
            <p className="text-xs text-orange-700 mt-2">SMS sent so far</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="history">Usage</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        {/* Balance & Buy Tab */}
        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request SMS Bundle</CardTitle>
              <CardDescription>Buy SMS packages from super admin</CardDescription>
            </CardHeader>
            <CardContent>
              {bundles.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-600">No bundles available. Contact super admin.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {bundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      onClick={() => setSelectedBundle(bundle.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                        selectedBundle === bundle.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-lg">{bundle.sms_count} SMS</h3>
                          <p className="text-sm text-gray-600">{bundle.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">KES {bundle.price_ksh}</div>
                          <div className="text-xs text-gray-500">
                            KES {(bundle.price_ksh / bundle.sms_count).toFixed(2)}/SMS
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedBundle && (
                    <Button
                      onClick={() => handleRequestBundle(selectedBundle)}
                      disabled={requestingBundle}
                      className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
                    >
                      {requestingBundle ? 'Processing...' : 'Request Bundle'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS Usage History</CardTitle>
              <CardDescription>Track messages sent</CardDescription>
            </CardHeader>
            <CardContent>
              {usageHistory.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <History className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No SMS sent yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {usageHistory.map((entry, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{entry.recipient_count} messages</p>
                          <p className="text-xs text-gray-600">{entry.message_preview}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-orange-600">-{entry.sms_deducted}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Requests</CardTitle>
              <CardDescription>Your SMS purchase requests</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <Send className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No requests yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.map((trans) => (
                    <div key={trans.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{trans.sms_count} SMS Bundle</p>
                          <p className="text-xs text-gray-600">KES {trans.price_ksh}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(trans.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          {trans.status === 'approved' && (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                              <CheckCircle className="w-4 h-4" />
                              Approved
                            </div>
                          )}
                          {trans.status === 'pending' && (
                            <div className="flex items-center gap-1 text-yellow-600 text-xs font-semibold">
                              <Clock className="w-4 h-4" />
                              Pending
                            </div>
                          )}
                          {trans.status === 'rejected' && (
                            <div className="text-red-600 text-xs font-semibold">Rejected</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
