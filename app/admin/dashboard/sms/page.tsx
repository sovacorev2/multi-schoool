'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, AlertCircle, CheckCircle } from 'lucide-react'

// Hardcoded SMS bundles - no database needed
const SMS_BUNDLES = [
  { id: '1', sms_count: 100, price_ksh: 500 },
  { id: '2', sms_count: 500, price_ksh: 2000 },
  { id: '3', sms_count: 1000, price_ksh: 3500 },
  { id: '4', sms_count: 5000, price_ksh: 15000 }
]

export default function SchoolSMSPage() {
  const [activeTab, setActiveTab] = useState('request')
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const handleRequestBundle = async (bundleId: string) => {
    setRequesting(true)
    setMessage('')

    try {
      const bundle = SMS_BUNDLES.find(b => b.id === bundleId)
      if (!bundle) return

      // Simulate request submission
      setMessage(`Bundle request sent: ${bundle.sms_count} SMS @ KES ${bundle.price_ksh}. Super admin will approve shortly.`)
      setMessageType('success')
      setSelectedBundle(null)

      setTimeout(() => {
        setMessage('')
      }, 4000)
    } catch (error) {
      setMessage('Error sending request. Please try again.')
      setMessageType('error')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">SMS Communications</h1>
        <p className="text-gray-600 mt-1">Purchase SMS packages for school communications</p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-900">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">0</div>
            <p className="text-xs text-blue-700 mt-2">SMS messages available</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900">Available Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{SMS_BUNDLES.length}</div>
            <p className="text-xs text-green-700 mt-2">SMS bundles to purchase</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="request">Request SMS</TabsTrigger>
          <TabsTrigger value="info">How It Works</TabsTrigger>
        </TabsList>

        {/* Request SMS Tab */}
        <TabsContent value="request" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request SMS Bundle</CardTitle>
              <CardDescription>Select a package and submit your request to the super admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {SMS_BUNDLES.map((bundle) => (
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
              </div>

              {message && (
                <div className={`p-3 rounded-lg flex items-start gap-3 ${
                  messageType === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {messageType === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />}
                  <p className="text-sm">{message}</p>
                </div>
              )}

              {selectedBundle && (
                <Button
                  onClick={() => handleRequestBundle(selectedBundle)}
                  disabled={requesting}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base"
                >
                  {requesting ? 'Sending Request...' : 'Send Request to Super Admin'}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How SMS Works</CardTitle>
              <CardDescription>Step-by-step guide to purchasing SMS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600 text-white font-bold">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Select a Package</h3>
                    <p className="text-sm text-gray-600 mt-1">Choose an SMS bundle (100, 500, 1000, or 5000 messages)</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600 text-white font-bold">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Send Request</h3>
                    <p className="text-sm text-gray-600 mt-1">Click "Send Request" to submit to the super admin for approval</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600 text-white font-bold">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Wait for Approval</h3>
                    <p className="text-sm text-gray-600 mt-1">Super admin reviews your request and approves it</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600 text-white font-bold">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Credits Added</h3>
                    <p className="text-sm text-gray-600 mt-1">Once approved, SMS balance updates and you can start sending</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Pricing</h4>
                <p className="text-sm text-blue-700">Each SMS package has transparent pricing shown per message. You'll see the exact cost before sending your request.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
