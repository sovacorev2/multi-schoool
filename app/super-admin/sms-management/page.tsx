'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  MessageSquare, CreditCard, TrendingUp, Users, Phone, DollarSign, 
  RefreshCw, AlertCircle, CheckCircle, Clock, Eye, EyeOff
} from 'lucide-react'

// Hardcoded SMS bundles - no database needed
const SMS_BUNDLES = [
  { id: '1', sms_count: 100, price_ksh: 500 },
  { id: '2', sms_count: 500, price_ksh: 2000 },
  { id: '3', sms_count: 1000, price_ksh: 3500 },
  { id: '4', sms_count: 5000, price_ksh: 15000 }
]

export default function SuperAdminSMSPage() {
  const [balance, setBalance] = useState<number>(0)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [buyingSMS, setBuyingSMS] = useState(false)
  const [smsAmount, setSmsAmount] = useState('')
  const [buyMessage, setBuyMessage] = useState('')
  const [buySuccess, setBuySuccess] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance()
      const interval = setInterval(fetchBalance, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const fetchBalance = async () => {
    try {
      setLoadingBalance(true)
      const res = await fetch('/api/sms/africas-talking-balance')
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance || 0)
      }
    } catch (error) {
      console.error('[v0] Error fetching balance:', error)
    } finally {
      setLoadingBalance(false)
    }
  }

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'shuletech') {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid password')
    }
  }

  const handleBuySMS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smsAmount) return

    setBuyingSMS(true)
    setBuyMessage('')
    try {
      const response = await fetch('/api/sms/buy-from-africas-talking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(smsAmount) })
      })

      if (response.ok) {
        setBuySuccess(true)
        setBuyMessage(`Successfully purchased ${smsAmount} SMS!`)
        setSmsAmount('')
        setTimeout(() => {
          fetchBalance()
          setBuySuccess(false)
        }, 1000)
      } else {
        setBuyMessage('Failed to purchase SMS. Please try again.')
      }
    } catch (error) {
      console.error('[v0] Error buying SMS:', error)
      setBuyMessage('Error: Could not complete purchase')
    } finally {
      setBuyingSMS(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              SMS Management
            </CardTitle>
            <CardDescription>Super Admin Portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter super admin password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {authError}
                </div>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Access SMS Management
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SMS Management</h1>
            <p className="text-gray-600 mt-1">Manage SMS credits from Africa's Talking</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setIsAuthenticated(false)
              setPassword('')
            }}
          >
            Logout
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Africa's Talking Balance
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchBalance}
                disabled={loadingBalance}
              >
                <RefreshCw className={`w-4 h-4 ${loadingBalance ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-900">KES {balance.toLocaleString()}</div>
            <p className="text-sm text-blue-700 mt-2">Available for school purchases</p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buy">Buy SMS</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-900">Status</h3>
                    </div>
                    <p className="text-sm text-green-700">Africa's Talking connected</p>
                    <p className="text-sm text-green-700 mt-1">SMS system active</p>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-blue-900">Available Bundles</h3>
                    </div>
                    <p className="text-sm text-blue-700">{SMS_BUNDLES.length} packages configured</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-3">SMS Packages</h3>
                  <div className="space-y-2">
                    {SMS_BUNDLES.map((bundle) => (
                      <div key={bundle.id} className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                        <span className="text-sm font-medium">{bundle.sms_count} SMS</span>
                        <span className="text-sm text-gray-600">KES {bundle.price_ksh}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buy SMS Tab */}
          <TabsContent value="buy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Purchase SMS from Africa's Talking</CardTitle>
                <CardDescription>Buy SMS credits directly</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBuySMS} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of SMS to Purchase
                    </label>
                    <Input
                      type="number"
                      value={smsAmount}
                      onChange={(e) => setSmsAmount(e.target.value)}
                      placeholder="e.g., 1000"
                      min="100"
                      step="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum: 100 SMS</p>
                  </div>

                  {smsAmount && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">SMS Amount:</span>
                          <span className="font-semibold">{parseInt(smsAmount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Rate:</span>
                          <span className="font-semibold">KES 0.50 per SMS</span>
                        </div>
                        <div className="border-t border-blue-200 pt-2 flex justify-between">
                          <span className="text-gray-900 font-semibold">Total:</span>
                          <span className="font-bold text-blue-900">KES {(parseInt(smsAmount) * 0.5).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {buyMessage && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                      buySuccess
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      {buySuccess ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {buyMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={buyingSMS || !smsAmount}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {buyingSMS ? 'Processing...' : 'Buy SMS Now'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
