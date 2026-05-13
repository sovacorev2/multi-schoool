'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  MessageSquare, CreditCard, TrendingUp, Users, Phone, DollarSign, 
  RefreshCw, AlertCircle, CheckCircle, Clock, Eye, EyeOff
} from 'lucide-react'

interface SuperAdminSMSState {
  africastalkingBalance: number
  loadingBalance: boolean
  activeSchoolsWithSMS: number
  totalSchoolsPossible: number
  recentTransactions: any[]
  bundles: any[]
}

export default function SuperAdminSMSPage() {
  const [state, setState] = useState<SuperAdminSMSState>({
    africastalkingBalance: 0,
    loadingBalance: false,
    activeSchoolsWithSMS: 0,
    totalSchoolsPossible: 0,
    recentTransactions: [],
    bundles: []
  })

  const [activeTab, setActiveTab] = useState('overview')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  
  // Buy SMS from Africa's Talking
  const [buyingSMS, setBuyingSMS] = useState(false)
  const [smsAmount, setSmsAmount] = useState('')
  const [smsPrice, setSmsPrice] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated])

  const loadDashboardData = async () => {
    try {
      // Load Africa's Talking balance
      const balanceRes = await fetch('/api/sms/africas-talking-balance')
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        console.log('[v0] Balance API response:', balanceData)
        setState(prev => ({ ...prev, africastalkingBalance: balanceData.balance || 0 }))
      } else {
        console.error('[v0] Balance API error status:', balanceRes.status)
      }

      // Load active schools with SMS
      const { data: schools, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name, code, feature_sms')

      if (!schoolsError && schools) {
        const activeSMSSchools = schools.filter((s: any) => s.feature_sms).length
        setState(prev => ({
          ...prev,
          activeSchoolsWithSMS: activeSMSSchools,
          totalSchoolsPossible: schools.length
        }))
      }

      // Load bundles
      const { data: bundlesData, error: bundlesError } = await supabase
        .from('sms_bundles')
        .select('*')
        .order('sms_count')

      if (bundlesError?.code === 'PGRST116') {
        console.log('[v0] SMS tables not found - setup needed')
        setSetupNeeded(true)
        return
      }

      if (bundlesData) {
        setState(prev => ({ ...prev, bundles: bundlesData }))
      }

      // Load recent transactions
      const { data: transData } = await supabase
        .from('sms_transactions')
        .select('*, schools(name, code)')
        .order('created_at', { ascending: false })
        .limit(10)

      if (transData) {
        setState(prev => ({ ...prev, recentTransactions: transData }))
      }
    } catch (error) {
      console.error('[v0] Error loading dashboard:', error)
    }
  }

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault()
    // Simple auth - in production, use proper authentication
    if (password === 'shuletech') {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid password')
    }
  }

  const handleSetupDatabase = async () => {
    setSettingUp(true)
    try {
      const response = await fetch('/api/sms/setup-database', {
        method: 'POST'
      })

      if (response.ok) {
        alert('SMS database setup completed! Please refresh the page.')
        setSetupNeeded(false)
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        const data = await response.json()
        alert(`Setup message: ${data.error || 'Unknown error'}. Please check Supabase console.`)
      }
    } catch (error) {
      console.error('[v0] Error setting up database:', error)
      alert('Failed to setup database. Check console for errors.')
    } finally {
      setSettingUp(false)
    }
  }

  const handleBuySMS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!smsAmount) return

    setBuyingSMS(true)
    try {
      const response = await fetch('/api/sms/buy-from-africas-talking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(smsAmount) })
      })

      if (response.ok) {
        alert('SMS purchase initiated successfully!')
        setSmsAmount('')
        loadDashboardData()
      } else {
        alert('Failed to purchase SMS')
      }
    } catch (error) {
      console.error('[v0] Error buying SMS:', error)
      alert('Error purchasing SMS')
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

  // Show setup required message
  if (setupNeeded) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="w-5 h-5" />
                Database Setup Required
              </CardTitle>
              <CardDescription className="text-yellow-800">
                SMS tables need to be created in Supabase before using the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                The SMS system requires database tables to store bundles, credits, and transactions. 
                You have two options:
              </p>

              <div className="space-y-3">
                <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Option 1: Automatic Setup</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Click the button below to automatically create all required SMS tables.
                  </p>
                  <Button
                    onClick={handleSetupDatabase}
                    disabled={settingUp}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {settingUp ? 'Setting up...' : 'Setup SMS Database'}
                  </Button>
                </div>

                <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">Option 2: Manual Setup</h3>
                  <p className="text-sm text-green-800 mb-3">
                    Go to Supabase SQL Editor and run the SQL from <code className="bg-green-100 px-2 py-1 rounded">scripts/create-sms-tables.sql</code>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                  >
                    Open Supabase
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <p className="text-gray-600 mt-1">Manage SMS credits and school communications</p>
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

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Africa's Talking Balance */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Africa's Talking Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">
                KES {state.africastalkingBalance.toLocaleString()}
              </div>
              <p className="text-xs text-blue-700 mt-2">Available for schools</p>
            </CardContent>
          </Card>

          {/* Active SMS Schools */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active SMS Schools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {state.activeSchoolsWithSMS}/{state.totalSchoolsPossible}
              </div>
              <p className="text-xs text-green-700 mt-2">Schools with SMS enabled</p>
            </CardContent>
          </Card>

          {/* Total Bundles */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                SMS Packages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{state.bundles.length}</div>
              <p className="text-xs text-purple-700 mt-2">Available bundles configured</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buy">Buy SMS</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Overview</CardTitle>
                <CardDescription>Current SMS system status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-700">System Status</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Africa's Talking Connected</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">SMS Feature Active</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-700">Quick Stats</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm text-gray-600">Your Balance</span>
                        <span className="font-semibold text-blue-900">
                          KES {state.africastalkingBalance.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-600">Active Schools</span>
                        <span className="font-semibold text-green-900">{state.activeSchoolsWithSMS}</span>
                      </div>
                    </div>
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
                <CardDescription>Buy SMS credits directly to resell to schools</CardDescription>
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
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum purchase: 100 SMS
                    </p>
                  </div>

                  {smsAmount && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">SMS Amount:</span>
                        <span className="font-semibold">{parseInt(smsAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Estimated Cost:</span>
                        <span className="font-semibold text-blue-900">
                          KES {(parseInt(smsAmount) * 0.5).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        Rate: KES 0.50 per SMS (subject to Africa's Talking pricing)
                      </p>
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

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>School SMS purchases and activity</CardDescription>
              </CardHeader>
              <CardContent>
                {state.recentTransactions.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-600">No transactions yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {state.recentTransactions.map((trans) => (
                      <div key={trans.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{trans.schools?.name}</p>
                            <p className="text-sm text-gray-600">{trans.schools?.code}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(trans.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              KES {trans.price_ksh?.toLocaleString()}
                            </div>
                            <div className="text-xs">
                              {trans.status === 'approved' && (
                                <span className="text-green-600 font-semibold">✓ Approved</span>
                              )}
                              {trans.status === 'pending' && (
                                <span className="text-yellow-600 font-semibold">⏱ Pending</span>
                              )}
                              {trans.status === 'rejected' && (
                                <span className="text-red-600 font-semibold">✕ Rejected</span>
                              )}
                            </div>
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
    </div>
  )
}
