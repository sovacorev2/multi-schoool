"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, History, AlertCircle, CheckCircle } from "lucide-react"

export default function SchoolSMSPage() {
  const [activeTab, setActiveTab] = useState("balance")
  const [balance, setBalance] = useState(0)
  const [bundles, setBundles] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [requestingBundle, setRequestingBundle] = useState(false)

  useEffect(() => {
    fetchSMSData()
  }, [])

  const fetchSMSData = async () => {
    try {
      setLoading(true)
      const [balanceRes, bundlesRes, transRes, usageRes] = await Promise.all([
        fetch('/api/sms/school-balance'),
        fetch('/api/sms/available-bundles'),
        fetch('/api/sms/school-transactions'),
        fetch('/api/sms/usage-history')
      ])

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        setBalance(balanceData.balance || 0)
      }

      if (bundlesRes.ok) {
        const bundlesData = await bundlesRes.json()
        setBundles(bundlesData.bundles || [])
      }

      if (transRes.ok) {
        const transData = await transRes.json()
        setTransactions(transData.transactions || [])
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        setUsageHistory(usageData.usage || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching SMS data:", error)
    } finally {
      setLoading(false)
    }
  }

  const requestBundle = async (bundleId: string) => {
    try {
      setRequestingBundle(true)
      const response = await fetch('/api/sms/request-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_id: bundleId })
      })

      if (response.ok) {
        setSelectedBundle(null)
        fetchSMSData()
        alert("SMS bundle request sent! Wait for super admin approval.")
      } else {
        alert("Failed to request bundle")
      }
    } catch (error) {
      console.error("[v0] Error requesting bundle:", error)
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
      <div>
        <h1 className="text-3xl font-bold">SMS Management</h1>
        <p className="text-gray-600">Manage your school's SMS communications</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Current SMS Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-blue-900">{balance} SMS</div>
          <p className="text-sm text-blue-700 mt-2">
            {balance === 0 ? "No credits available. Request a bundle below." : `${balance} messages available`}
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balance">SMS Balance</TabsTrigger>
          <TabsTrigger value="history">Usage History</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        {/* Balance Tab - Request Bundles */}
        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request SMS Bundle</CardTitle>
              <CardDescription>Choose a package and request approval from super admin</CardDescription>
            </CardHeader>
            <CardContent>
              {bundles.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-600">No SMS bundles available. Contact super admin.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {bundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className={`p-4 border rounded-lg cursor-pointer transition ${
                        selectedBundle === bundle.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedBundle(bundle.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{bundle.sms_count} SMS</h3>
                          <p className="text-sm text-gray-600">{bundle.description || 'SMS Bundle'}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">KES {bundle.price}</div>
                          <div className="text-xs text-gray-500">per SMS: KES {(bundle.price / bundle.sms_count).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedBundle && (
                    <Button
                      onClick={() => requestBundle(selectedBundle)}
                      disabled={requestingBundle}
                      className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
                    >
                      {requestingBundle ? 'Requesting...' : 'Request This Bundle'}
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
              <CardDescription>Track your SMS messages sent</CardDescription>
            </CardHeader>
            <CardContent>
              {usageHistory.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <History className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No SMS usage yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {usageHistory.map((entry, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{entry.recipient_count} message(s) sent</p>
                          <p className="text-xs text-gray-600">{entry.message_preview || 'Message sent'}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(entry.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right ml-4">
                          <span className="text-sm font-semibold">-{entry.sms_deducted}</span>
                        </div>
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
              <CardDescription>Your pending and approved SMS bundle requests</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No requests yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions.map((trans) => (
                    <div key={trans.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{trans.bundle_sms_count} SMS Bundle</p>
                          <p className="text-xs text-gray-600">KES {trans.bundle_price}</p>
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
                            <div className="text-yellow-600 text-xs font-semibold">Pending</div>
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
