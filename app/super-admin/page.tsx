'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Shield, Building2, Search, Settings, ToggleLeft, ToggleRight,
  FileText, MessageSquare, Award, Send, Calendar, ChevronDown, ChevronUp,
  Plus, Edit2, Save, X, Eye, EyeOff, LogOut, Users, Check
} from 'lucide-react'

interface School {
  id: string
  name: string
  code: string
  short_name: string | null
  tagline: string | null
  logo_url: string | null
  primary_color: string | null
  address: string | null
  phone: string | null
  email: string | null
  admin_password: string | null
  created_at: string
  feature_report_cards: boolean
  feature_whatsapp_reports: boolean
  feature_sms: boolean
  feature_bulk_sms: boolean
  feature_certificates: boolean
  feature_pin_management?: boolean
  subscription_plan: string
  subscription_expires_at: string | null
  is_active: boolean
  payment_amount: number | null
  payment_phone_number: string | null
  lock_override: boolean | null
}

interface PaymentTransaction {
  id: string
  amount: number
  phone_number: string | null
  ncba_transaction_id: string | null
  status: 'pending' | 'success' | 'failed'
  initiated_at: string
  completed_at: string | null
}

const SUPER_ADMIN_PASSWORD = 'shuletech2024'

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  
  const [schools, setSchools] = useState<School[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null)
  const [savingSchool, setSavingSchool] = useState<string | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<Record<string, PaymentTransaction[]>>({})
  const [sendingPromptFor, setSendingPromptFor] = useState<string | null>(null)
  const [promptMessage, setPromptMessage] = useState<{ schoolId: string; type: 'success' | 'error'; text: string } | null>(null)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  // New school form
  const [showNewSchoolForm, setShowNewSchoolForm] = useState(false)
  const [newSchool, setNewSchool] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: ''
  })
  const [isCreating, setIsCreating] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isAuthenticated) {
      fetchSchools()
      
      // Set up real-time subscription for schools table
      const channel = supabase
        .channel('schools-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schools' },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setSchools(prev => prev.map(s => 
                s.id === payload.new.id ? { ...s, ...payload.new } : s
              ))
            } else if (payload.eventType === 'INSERT') {
              setSchools(prev => [...prev, payload.new as School].sort((a, b) => a.name.localeCompare(b.name)))
            } else if (payload.eventType === 'DELETE') {
              setSchools(prev => prev.filter(s => s.id !== payload.old.id))
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isAuthenticated])

  async function fetchSchools() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name')
    
    if (!error && data) {
      setSchools(data)
    }
    setIsLoading(false)
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

  async function toggleFeature(schoolId: string, feature: keyof School, currentValue: boolean) {
    setSavingSchool(schoolId)
    const school = schools.find(s => s.id === schoolId)
    
    const { error } = await supabase
      .from('schools')
      .update({ [feature]: !currentValue })
      .eq('id', schoolId)
    
    if (!error) {
      // Update local state immediately for responsiveness
      setSchools(schools.map(s => 
        s.id === schoolId ? { ...s, [feature]: !currentValue } : s
      ))
      
      // Log the feature toggle action
      const featureNames: Record<string, string> = {
        feature_report_cards: 'Report Cards',
        feature_whatsapp_reports: 'WhatsApp Reports',
        feature_sms: 'SMS Communications',
        feature_bulk_sms: 'Bulk SMS',
        feature_certificates: 'Certificates',
        feature_pin_management: 'PIN Management'
      }
      
      await supabase.from('activity_logs').insert({
        school_id: schoolId,
        action: !currentValue ? 'feature_enabled' : 'feature_disabled',
        details: `${!currentValue ? 'Enabled' : 'Disabled'} ${featureNames[feature] || feature} for ${school?.name}`,
        performed_by: 'Super Admin'
      })
    }
    setSavingSchool(null)
  }

  async function updateSubscriptionPlan(schoolId: string, plan: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase
      .from('schools')
      .update({ subscription_plan: plan })
      .eq('id', schoolId)
    
    if (!error) {
      setSchools(schools.map(s => 
        s.id === schoolId ? { ...s, subscription_plan: plan } : s
      ))
    }
    setSavingSchool(null)
  }

  async function updateSubscriptionExpiry(schoolId: string, date: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase
      .from('schools')
      .update({ subscription_expires_at: date || null })
      .eq('id', schoolId)
    
    if (!error) {
      setSchools(schools.map(s =>
        s.id === schoolId ? { ...s, subscription_expires_at: date || null } : s
      ))
    }
    setSavingSchool(null)
  }

  async function updatePaymentAmount(schoolId: string, amount: string) {
    const numericAmount = amount === '' ? null : Number(amount)
    setSavingSchool(schoolId)
    const { error } = await supabase.from('schools').update({ payment_amount: numericAmount }).eq('id', schoolId)
    if (!error) {
      setSchools(schools.map(s => s.id === schoolId ? { ...s, payment_amount: numericAmount } : s))
    } else {
      alert(`Failed to save term fee amount: ${error.message}\n\nIf this mentions a missing column, scripts/005_add_ncba_payment_integration.sql still needs to be run in the Supabase SQL Editor.`)
    }
    setSavingSchool(null)
  }

  async function updatePaymentPhone(schoolId: string, phone: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase.from('schools').update({ payment_phone_number: phone || null }).eq('id', schoolId)
    if (!error) {
      setSchools(schools.map(s => s.id === schoolId ? { ...s, payment_phone_number: phone || null } : s))
    } else {
      alert(`Failed to save payment phone number: ${error.message}\n\nIf this mentions a missing column, scripts/005_add_ncba_payment_integration.sql still needs to be run in the Supabase SQL Editor.`)
    }
    setSavingSchool(null)
  }

  // Generic field-level save for the "School Details" card (short_name, tagline,
  // logo_url, primary_color, address, phone, email, admin_password) so every
  // school-identity field can be managed from here instead of the Supabase dashboard.
  async function updateSchoolDetail(schoolId: string, field: keyof School, value: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase.from('schools').update({ [field]: value || null }).eq('id', schoolId)
    if (!error) {
      setSchools(schools.map(s => s.id === schoolId ? { ...s, [field]: value || null } : s))
    } else {
      alert(`Failed to save: ${error.message}`)
    }
    setSavingSchool(null)
  }

  // null = automatic (locked once subscription_expires_at passes), true = force
  // unlocked, false = force locked. A super-admin override always wins over the
  // automatic expiry-based cron job.
  async function updateLockOverride(schoolId: string, override: boolean | null) {
    setSavingSchool(schoolId)
    const updates: { lock_override: boolean | null; is_active?: boolean } = { lock_override: override }
    // Apply immediately rather than waiting for the next cron run.
    if (override === true) updates.is_active = true
    if (override === false) updates.is_active = false
    const { error } = await supabase.from('schools').update(updates).eq('id', schoolId)
    if (!error) {
      setSchools(schools.map(s => s.id === schoolId ? { ...s, ...updates } : s))
    } else {
      alert(`Failed to update lock status: ${error.message}\n\nIf this mentions a missing column, scripts/005_add_ncba_payment_integration.sql still needs to be run in the Supabase SQL Editor.`)
    }
    setSavingSchool(null)
  }

  async function fetchPaymentHistory(schoolId: string) {
    const { data } = await supabase
      .from('payment_transactions')
      .select('id, amount, phone_number, ncba_transaction_id, status, initiated_at, completed_at')
      .eq('school_id', schoolId)
      .order('initiated_at', { ascending: false })
      .limit(20)
    setPaymentHistory(prev => ({ ...prev, [schoolId]: data || [] }))
  }

  async function sendPaymentPrompt(schoolId: string) {
    setSendingPromptFor(schoolId)
    setPromptMessage(null)
    try {
      const res = await fetch('/api/payments/ncba/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId }),
      })
      const data = await res.json()
      setPromptMessage({ schoolId, type: data.success ? 'success' : 'error', text: data.success ? data.message : data.error })
      if (data.success) fetchPaymentHistory(schoolId)
    } catch (error) {
      setPromptMessage({ schoolId, type: 'error', text: error instanceof Error ? error.message : 'Failed to send prompt' })
    }
    setSendingPromptFor(null)
  }

  async function createSchool(e: React.FormEvent) {
    e.preventDefault()
    if (!newSchool.name || !newSchool.code) return

    setIsCreating(true)
    const { data, error } = await supabase
      .from('schools')
      .insert({
        name: newSchool.name,
        code: newSchool.code.toLowerCase().replace(/\s+/g, '-'),
        address: newSchool.address || null,
        phone: newSchool.phone || null,
        email: newSchool.email || null,
        feature_report_cards: false,
        feature_whatsapp_reports: false,
        feature_certificates: false,
        feature_bulk_sms: false,
        subscription_plan: 'basic'
      })
      .select()
      .single()

    if (!error && data) {
      setSchools([...schools, data])
      setNewSchool({ name: '', code: '', address: '', phone: '', email: '' })
      setShowNewSchoolForm(false)
    }
    setIsCreating(false)
  }

  async function enableAllFeatures(schoolId: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase
      .from('schools')
      .update({ 
        feature_report_cards: true,
        feature_whatsapp_reports: true,
        feature_sms: true,
        feature_bulk_sms: true,
        feature_certificates: true,
        subscription_plan: 'premium'
      })
      .eq('id', schoolId)
    
    if (!error) {
      setSchools(schools.map(s => 
        s.id === schoolId ? { 
          ...s, 
          feature_report_cards: true,
          feature_whatsapp_reports: true,
          feature_sms: true,
          feature_bulk_sms: true,
          feature_certificates: true,
          subscription_plan: 'premium'
        } : s
      ))
    }
    setSavingSchool(null)
  }

  async function disableAllFeatures(schoolId: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase
      .from('schools')
      .update({ 
        feature_report_cards: false,
        feature_whatsapp_reports: false,
        feature_sms: false,
        feature_bulk_sms: false,
        feature_certificates: false,
        subscription_plan: 'basic'
      })
      .eq('id', schoolId)
    
    if (!error) {
      setSchools(schools.map(s => 
        s.id === schoolId ? { 
          ...s, 
          feature_report_cards: false,
          feature_whatsapp_reports: false,
          feature_sms: false,
          feature_bulk_sms: false,
          feature_certificates: false,
          subscription_plan: 'basic'
        } : s
      ))
    }
    setSavingSchool(null)
  }

  async function enablePilotFeatures(schoolId: string) {
    setSavingSchool(schoolId)
    const { error } = await supabase
      .from('schools')
      .update({ 
        feature_pin_management: true
      })
      .eq('id', schoolId)
    
    if (!error) {
      setSchools(schools.map(s => 
        s.id === schoolId ? { 
          ...s, 
          feature_pin_management: true
        } : s
      ))
    }
    setSavingSchool(null)
  }

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getFeatureCount = (school: School) => {
    let count = 0
    if (school.feature_report_cards) count++
    if (school.feature_whatsapp_reports) count++
    if (school.feature_certificates) count++
    if (school.feature_bulk_sms) count++
    if (school.feature_pin_management) count++
    return count
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
            <p className="text-gray-500 mt-1">Shuletech Management Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="password" className="text-gray-700">Admin Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {authError && (
                <p className="text-red-500 text-sm mt-2">{authError}</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800">
              Access Dashboard
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Shuletech Super Admin</h1>
                <p className="text-xs text-gray-500">Manage Schools & Features</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/super-admin/sms-management">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-gray-600 hover:text-blue-600 hover:border-blue-600"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  SMS Management
                </Button>
              </a>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsAuthenticated(false)}
                className="text-gray-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{schools.length}</p>
                <p className="text-sm text-gray-500">Total Schools</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {schools.filter(s => s.feature_report_cards).length}
                </p>
                <p className="text-sm text-gray-500">Report Cards</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {schools.filter(s => s.feature_whatsapp_reports).length}
                </p>
                <p className="text-sm text-gray-500">WhatsApp Reports</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {schools.filter(s => s.feature_bulk_sms).length}
                </p>
                <p className="text-sm text-gray-500">SMS Enabled</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {schools.filter(s => s.subscription_plan === 'premium').length}
                </p>
                <p className="text-sm text-gray-500">Premium Plans</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search schools by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            onClick={() => setShowNewSchoolForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add School
          </Button>
        </div>

        {/* New School Form Modal */}
        {showNewSchoolForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-lg">Register New School</h3>
                <button onClick={() => setShowNewSchoolForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={createSchool} className="p-6 space-y-4">
                <div>
                  <Label htmlFor="schoolName">School Name *</Label>
                  <Input
                    id="schoolName"
                    value={newSchool.name}
                    onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                    placeholder="e.g. Amagoro Comprehensive School"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="schoolCode">School Code *</Label>
                  <Input
                    id="schoolCode"
                    value={newSchool.code}
                    onChange={(e) => setNewSchool({ ...newSchool, code: e.target.value })}
                    placeholder="e.g. amagoro"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Unique identifier, lowercase, no spaces</p>
                </div>
                <div>
                  <Label htmlFor="schoolAddress">Address</Label>
                  <Input
                    id="schoolAddress"
                    value={newSchool.address}
                    onChange={(e) => setNewSchool({ ...newSchool, address: e.target.value })}
                    placeholder="e.g. P.O. Box 123, Busia"
                  />
                </div>
                <div>
                  <Label htmlFor="schoolPhone">Phone</Label>
                  <Input
                    id="schoolPhone"
                    value={newSchool.phone}
                    onChange={(e) => setNewSchool({ ...newSchool, phone: e.target.value })}
                    placeholder="e.g. 0712345678"
                  />
                </div>
                <div>
                  <Label htmlFor="schoolEmail">Email</Label>
                  <Input
                    id="schoolEmail"
                    type="email"
                    value={newSchool.email}
                    onChange={(e) => setNewSchool({ ...newSchool, email: e.target.value })}
                    placeholder="e.g. info@school.ac.ke"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowNewSchoolForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {isCreating ? 'Creating...' : 'Create School'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Schools List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading schools...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchools.map((school) => (
              <div key={school.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* School Header */}
                <div 
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    const opening = expandedSchool !== school.id
                    setExpandedSchool(opening ? school.id : null)
                    if (opening && !paymentHistory[school.id]) fetchPaymentHistory(school.id)
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {school.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{school.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{school.code}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          school.subscription_plan === 'premium' 
                            ? 'bg-purple-100 text-purple-700' 
                            : school.subscription_plan === 'standard'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {school.subscription_plan.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${school.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {school.is_active ? 'UNLOCKED' : 'LOCKED'}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span>{getFeatureCount(school)}/5 features</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {savingSchool === school.id && (
                      <span className="text-sm text-blue-600 animate-pulse">Saving...</span>
                    )}
                    {expandedSchool === school.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedSchool === school.id && (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <Button 
                        size="sm" 
                        onClick={() => enableAllFeatures(school.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Enable All Features
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => enablePilotFeatures(school.id)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Enable Pilot Features
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => disableAllFeatures(school.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Disable All
                      </Button>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {/* Report Cards */}
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        school.feature_report_cards 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              school.feature_report_cards ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <FileText className={`w-5 h-5 ${
                                school.feature_report_cards ? 'text-green-600' : 'text-gray-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Report Cards</p>
                              <p className="text-xs text-gray-500">Print CBC report cards</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleFeature(school.id, 'feature_report_cards', school.feature_report_cards)}
                            className="focus:outline-none"
                          >
                            {school.feature_report_cards ? (
                              <ToggleRight className="w-10 h-10 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-10 h-10 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* WhatsApp Reports */}
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        school.feature_whatsapp_reports 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              school.feature_whatsapp_reports ? 'bg-emerald-100' : 'bg-gray-100'
                            }`}>
                              <MessageSquare className={`w-5 h-5 ${
                                school.feature_whatsapp_reports ? 'text-emerald-600' : 'text-gray-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">WhatsApp Reports</p>
                              <p className="text-xs text-gray-500">Send results via WhatsApp</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleFeature(school.id, 'feature_whatsapp_reports', school.feature_whatsapp_reports)}
                            className="focus:outline-none"
                          >
                            {school.feature_whatsapp_reports ? (
                              <ToggleRight className="w-10 h-10 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-10 h-10 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Certificates */}
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        school.feature_certificates 
                          ? 'bg-purple-50 border-purple-200' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              school.feature_certificates ? 'bg-purple-100' : 'bg-gray-100'
                            }`}>
                              <Award className={`w-5 h-5 ${
                                school.feature_certificates ? 'text-purple-600' : 'text-gray-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Certificates</p>
                              <p className="text-xs text-gray-500">Print achievement certificates</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleFeature(school.id, 'feature_certificates', school.feature_certificates)}
                            className="focus:outline-none"
                          >
                            {school.feature_certificates ? (
                              <ToggleRight className="w-10 h-10 text-purple-600" />
                            ) : (
                              <ToggleLeft className="w-10 h-10 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bulk SMS */}
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        school.feature_bulk_sms 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              school.feature_bulk_sms ? 'bg-orange-100' : 'bg-gray-100'
                            }`}>
                              <Send className={`w-5 h-5 ${
                                school.feature_bulk_sms ? 'text-orange-600' : 'text-gray-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Bulk SMS</p>
                              <p className="text-xs text-gray-500">Send bulk SMS to parents</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleFeature(school.id, 'feature_bulk_sms', school.feature_bulk_sms)}
                            className="focus:outline-none"
                          >
                            {school.feature_bulk_sms ? (
                              <ToggleRight className="w-10 h-10 text-orange-600" />
                            ) : (
                              <ToggleLeft className="w-10 h-10 text-gray-300" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* PIN Management */}
                      {school.feature_pin_management !== undefined && (
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          school.feature_pin_management 
                            ? 'bg-cyan-50 border-cyan-200' 
                            : 'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                school.feature_pin_management ? 'bg-cyan-100' : 'bg-gray-100'
                              }`}>
                                <Shield className={`w-5 h-5 ${
                                  school.feature_pin_management ? 'text-cyan-600' : 'text-gray-400'
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">PIN Management</p>
                                <p className="text-xs text-gray-500">Teacher PIN tracking & audit logs</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleFeature(school.id, 'feature_pin_management', school.feature_pin_management)}
                              className="focus:outline-none"
                            >
                              {school.feature_pin_management ? (
                                <ToggleRight className="w-10 h-10 text-cyan-600" />
                              ) : (
                                <ToggleLeft className="w-10 h-10 text-gray-300" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* School Details - everything else that used to require opening Supabase directly */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        School Details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label htmlFor={`shortname-${school.id}`}>Short Name</Label>
                          <Input
                            id={`shortname-${school.id}`}
                            type="text"
                            defaultValue={school.short_name ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'short_name', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tagline-${school.id}`}>Tagline</Label>
                          <Input
                            id={`tagline-${school.id}`}
                            type="text"
                            defaultValue={school.tagline ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'tagline', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`logo-${school.id}`}>Logo URL</Label>
                          <Input
                            id={`logo-${school.id}`}
                            type="text"
                            placeholder="https://..."
                            defaultValue={school.logo_url ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'logo_url', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`color-${school.id}`}>Primary Color</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={school.primary_color || '#2563eb'}
                              onChange={(e) => updateSchoolDetail(school.id, 'primary_color', e.target.value)}
                              className="w-10 h-9 rounded border border-gray-300 cursor-pointer"
                            />
                            <Input
                              id={`color-${school.id}`}
                              type="text"
                              defaultValue={school.primary_color ?? ''}
                              onBlur={(e) => updateSchoolDetail(school.id, 'primary_color', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`address-${school.id}`}>Address</Label>
                          <Input
                            id={`address-${school.id}`}
                            type="text"
                            defaultValue={school.address ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'address', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`schoolphone-${school.id}`}>Phone</Label>
                          <Input
                            id={`schoolphone-${school.id}`}
                            type="text"
                            defaultValue={school.phone ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'phone', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`schoolemail-${school.id}`}>Email</Label>
                          <Input
                            id={`schoolemail-${school.id}`}
                            type="email"
                            defaultValue={school.email ?? ''}
                            onBlur={(e) => updateSchoolDetail(school.id, 'email', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`adminpw-${school.id}`}>Admin Portal Password</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              id={`adminpw-${school.id}`}
                              type={showAdminPassword ? 'text' : 'password'}
                              defaultValue={school.admin_password ?? ''}
                              onBlur={(e) => updateSchoolDetail(school.id, 'admin_password', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="p-2 text-gray-500 hover:text-gray-700 shrink-0"
                            >
                              {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">What this school's admin uses to log in to their admin portal. Change it here to reset it for them.</p>
                        </div>
                      </div>
                    </div>

                    {/* Subscription Settings */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Subscription Settings
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`plan-${school.id}`}>Subscription Plan</Label>
                          <select
                            id={`plan-${school.id}`}
                            value={school.subscription_plan}
                            onChange={(e) => updateSubscriptionPlan(school.id, e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="basic">Basic (Free)</option>
                            <option value="standard">Standard</option>
                            <option value="premium">Premium</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`expiry-${school.id}`}>Subscription Expires</Label>
                          <Input
                            id={`expiry-${school.id}`}
                            type="date"
                            value={school.subscription_expires_at ? school.subscription_expires_at.split('T')[0] : ''}
                            onChange={(e) => updateSubscriptionExpiry(school.id, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Payments (NCBA STK Push) */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
                      <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Payments
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label htmlFor={`amount-${school.id}`}>Term Fee Amount (KES)</Label>
                          <Input
                            id={`amount-${school.id}`}
                            type="number"
                            min="0"
                            placeholder="e.g. 15000"
                            defaultValue={school.payment_amount ?? ''}
                            onBlur={(e) => updatePaymentAmount(school.id, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`phone-${school.id}`}>Payment Phone Number</Label>
                          <Input
                            id={`phone-${school.id}`}
                            type="text"
                            placeholder="2547XXXXXXXX"
                            defaultValue={school.payment_phone_number ?? ''}
                            onBlur={(e) => updatePaymentPhone(school.id, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* Manual lock/unlock override */}
                      <div className="mb-4">
                        <Label>Access Control</Label>
                        <div className="flex gap-2 mt-1">
                          {([
                            { value: null, label: 'Automatic', color: 'gray' },
                            { value: true, label: 'Force Unlocked', color: 'emerald' },
                            { value: false, label: 'Force Locked', color: 'red' },
                          ] as const).map(opt => {
                            const isActive = school.lock_override === opt.value
                            return (
                              <button
                                key={opt.label}
                                onClick={() => updateLockOverride(school.id, opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  isActive
                                    ? opt.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600'
                                    : opt.color === 'red' ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-gray-700 text-white border-gray-700'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Automatic locks the school once its subscription expiry date passes. Force Unlocked/Locked always overrides that, regardless of payment status.
                        </p>
                      </div>

                      {/* Send prompt */}
                      <div className="flex items-center gap-3 mb-4">
                        <Button
                          size="sm"
                          onClick={() => sendPaymentPrompt(school.id)}
                          disabled={sendingPromptFor === school.id || !school.payment_amount || !school.payment_phone_number}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          {sendingPromptFor === school.id ? 'Sending...' : 'Send Payment Prompt (STK Push)'}
                        </Button>
                        {promptMessage && promptMessage.schoolId === school.id && (
                          <span className={`text-xs ${promptMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {promptMessage.text}
                          </span>
                        )}
                      </div>

                      {/* Payment history */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Transactions</p>
                        {(paymentHistory[school.id] || []).length === 0 ? (
                          <p className="text-xs text-gray-400">No payment attempts yet.</p>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="p-2 text-left">Date</th>
                                  <th className="p-2 text-left">Phone</th>
                                  <th className="p-2 text-right">Amount</th>
                                  <th className="p-2 text-left">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(paymentHistory[school.id] || []).map(tx => (
                                  <tr key={tx.id} className="border-t">
                                    <td className="p-2">{new Date(tx.initiated_at).toLocaleString()}</td>
                                    <td className="p-2">{tx.phone_number || '-'}</td>
                                    <td className="p-2 text-right">{tx.amount}</td>
                                    <td className="p-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                        tx.status === 'success' ? 'bg-emerald-100 text-emerald-700'
                                        : tx.status === 'failed' ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {tx.status.toUpperCase()}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* School Info */}
                    <div className="mt-4 text-sm text-gray-500 flex flex-wrap gap-4">
                      {school.address && <span>Address: {school.address}</span>}
                      {school.phone && <span>Phone: {school.phone}</span>}
                      {school.email && <span>Email: {school.email}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredSchools.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No schools found</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
