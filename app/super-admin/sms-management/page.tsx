'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  MessageSquare, Plus, Edit2, Save, X, Check, AlertCircle, 
  DollarSign, TrendingUp, ToggleLeft, ToggleRight, ChevronDown, ChevronUp
} from 'lucide-react'

interface SMSBundle {
  id: string
  sms_count: number
  price_ksh: number
  description: string
}

interface SchoolSMSCredit {
  id: string
  school_id: string
  schools: { name: string; code: string }
  available_credits: number
  feature_sms: boolean
}

interface SMSTransaction {
  id: string
  school_id: string
  schools: { name: string }
  bundle_id: string
  sms_bundles: { sms_count: number }
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const SUPER_ADMIN_PASSWORD = 'shuletech2024'

export default function SMSManagementPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState<'bundles' | 'credits' | 'transactions'>('bundles')

  // Bundle Management
  const [bundles, setBundles] = useState<SMSBundle[]>([])
  const [showBundleForm, setShowBundleForm] = useState(false)
  const [editingBundle, setEditingBundle] = useState<SMSBundle | null>(null)
  const [bundleForm, setBundleForm] = useState({ sms_count: '', price_ksh: '', description: '' })
  const [bundleSaving, setBundleSaving] = useState(false)

  // Credits Management
  const [credits, setCredits] = useState<SchoolSMSCredit[]>([])
  const [creditsLoading, setCreditsLoading] = useState(false)

  // Transactions
  const [transactions, setTransactions] = useState<SMSTransaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'bundles') {
        loadBundles()
      } else if (activeTab === 'credits') {
        loadCredits()
      } else if (activeTab === 'transactions') {
        loadTransactions()
      }
    }
  }, [activeTab, isAuthenticated])

  async function loadAllData() {
    await loadBundles()
    await loadCredits()
    await loadTransactions()
  }

  async function loadBundles() {
    const { data, error } = await supabase
      .from('sms_bundles')
      .select('*')
      .order('sms_count')

    if (!error && data) {
      setBundles(data)
    }
  }

  async function loadCredits() {
    setCreditsLoading(true)
    const { data, error } = await supabase
      .from('school_sms_credits')
      .select('*, schools(name, code)')
      .order('schools(name)')

    if (!error && data) {
      setCredits(data as SchoolSMSCredit[])
    }
    setCreditsLoading(false)
  }

  async function loadTransactions() {
    setTransactionsLoading(true)
    const { data, error } = await supabase
      .from('sms_transactions')
      .select('*, schools(name), sms_bundles(sms_count)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTransactions(data as SMSTransaction[])
    }
    setTransactionsLoading(false)
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (password === SUPER_ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setAuthError('')
    } else {
      setAuthError('Invalid password')
    }
  }

  async function handleSaveBundle(e: React.FormEvent) {
    e.preventDefault()
    if (!bundleForm.sms_count || !bundleForm.price_ksh) return

    setBundleSaving(true)

    if (editingBundle) {
      const { error } = await supabase
        .from('sms_bundles')
        .update({
          sms_count: parseInt(bundleForm.sms_count),
          price_ksh: parseFloat(bundleForm.price_ksh),
          description: bundleForm.description
        })
        .eq('id', editingBundle.id)

      if (!error) {
        await loadBundles()
        setEditingBundle(null)
        setBundleForm({ sms_count: '', price_ksh: '', description: '' })
      }
    } else {
      const { error } = await supabase
        .from('sms_bundles')
        .insert({
          sms_count: parseInt(bundleForm.sms_count),
          price_ksh: parseFloat(bundleForm.price_ksh),
          description: bundleForm.description
        })

      if (!error) {
        await loadBundles()
        setBundleForm({ sms_count: '', price_ksh: '', description: '' })
        setShowBundleForm(false)
      }
    }

    setBundleSaving(false)
  }

  async function handleDeleteBundle(id: string) {
    await supabase.from('sms_bundles').delete().eq('id', id)
    await loadBundles()
  }

  async function toggleSMSFeature(schoolId: string, currentValue: boolean) {
    await supabase
      .from('schools')
      .update({ feature_sms: !currentValue })
      .eq('id', schoolId)
    
    await loadCredits()
  }

  async function approveTransaction(transactionId: string, bundleId: string, schoolId: string, smsCount: number) {
    const { error: updateError } = await supabase
      .from('sms_transactions')
      .update({ status: 'approved' })
      .eq('id', transactionId)

    if (!updateError) {
      const { data: creditData } = await supabase
        .from('school_sms_credits')
        .select('available_credits')
        .eq('school_id', schoolId)
        .single()

      if (creditData) {
        await supabase
          .from('school_sms_credits')
          .update({ available_credits: (creditData.available_credits || 0) + smsCount })
          .eq('school_id', schoolId)
      }

      await loadTransactions()
      await loadCredits()
    }
  }

  async function rejectTransaction(transactionId: string) {
    await supabase
      .from('sms_transactions')
      .update({ status: 'rejected' })
      .eq('id', transactionId)
    
    await loadTransactions()
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            <h1 className="ml-3 text-2xl font-bold text-gray-900">SMS Management</h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="password">Super Admin Password</Label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Login
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">SMS Management</h1>
          </div>
          <Button
            onClick={() => {
              setIsAuthenticated(false)
              setPassword('')
            }}
            variant="outline"
          >
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow">
          {(['bundles', 'credits', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded font-medium transition ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'bundles' && 'SMS Bundles'}
              {tab === 'credits' && 'School Credits'}
              {tab === 'transactions' && 'Transactions'}
            </button>
          ))}
        </div>

        {/* Bundles Tab */}
        {activeTab === 'bundles' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">SMS Bundle Packages</h2>
              {!showBundleForm && !editingBundle && (
                <Button onClick={() => setShowBundleForm(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Bundle
                </Button>
              )}
            </div>

            {(showBundleForm || editingBundle) && (
              <div className="bg-white rounded-lg shadow p-6">
                <form onSubmit={handleSaveBundle} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>SMS Count</Label>
                      <Input
                        type="number"
                        value={bundleForm.sms_count}
                        onChange={(e) => setBundleForm({ ...bundleForm, sms_count: e.target.value })}
                        placeholder="100"
                        required
                      />
                    </div>
                    <div>
                      <Label>Price (KES)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={bundleForm.price_ksh}
                        onChange={(e) => setBundleForm({ ...bundleForm, price_ksh: e.target.value })}
                        placeholder="1000"
                        required
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={bundleForm.description}
                        onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })}
                        placeholder="Basic bundle"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={bundleSaving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {bundleSaving ? 'Saving...' : 'Save Bundle'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowBundleForm(false)
                        setEditingBundle(null)
                        setBundleForm({ sms_count: '', price_ksh: '', description: '' })
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid gap-4">
              {bundles.map((bundle) => (
                <div key={bundle.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{bundle.sms_count} SMS</h3>
                      <p className="text-sm text-gray-600">{bundle.description}</p>
                      <p className="text-lg font-semibold text-green-600 mt-1">KES {bundle.price_ksh.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setEditingBundle(bundle)
                          setBundleForm({
                            sms_count: bundle.sms_count.toString(),
                            price_ksh: bundle.price_ksh.toString(),
                            description: bundle.description
                          })
                          setShowBundleForm(false)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteBundle(bundle.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">School SMS Balances</h2>

            {creditsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="grid gap-4">
                {credits.map((credit) => (
                  <div key={credit.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{credit.schools?.name}</h3>
                        <p className="text-sm text-gray-600">{credit.schools?.code}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          <span className="font-semibold text-lg text-blue-600">
                            {credit.available_credits.toLocaleString()} SMS Available
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">SMS Feature:</span>
                        <button
                          onClick={() => toggleSMSFeature(credit.school_id, credit.feature_sms)}
                          className={`p-2 rounded-full transition ${
                            credit.feature_sms
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {credit.feature_sms ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">SMS Purchase Requests</h2>

            {transactionsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="grid gap-4">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{tx.schools?.name}</h3>
                        <p className="text-sm text-gray-600">
                          {tx.sms_bundles?.sms_count.toLocaleString()} SMS Bundle
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          tx.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : tx.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {tx.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {tx.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveTransaction(
                            tx.id,
                            tx.bundle_id,
                            tx.school_id,
                            tx.sms_bundles?.sms_count || 0
                          )}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => rejectTransaction(tx.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
