import { createClient } from '@supabase/supabase-js'

export interface SMSBundle {
  id: string
  name: string
  sms_count: number
  price_ksh: number
}

export interface SchoolSMSCredits {
  balance: number
  total_purchased: number
  total_used: number
}

export interface SMSTransaction {
  id: string
  school_id: string
  bundle_id: string
  sms_count: number
  price_ksh: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  approved_at?: string
}

// Get all SMS bundles
export async function getSMSBundles(supabaseClient: any): Promise<SMSBundle[]> {
  const { data, error } = await supabaseClient
    .from('sms_bundles')
    .select('*')
    .order('sms_count', { ascending: true })

  if (error) throw error
  return data || []
}

// Get school SMS credits
export async function getSchoolSMSCredits(
  supabaseClient: any,
  schoolId: string
): Promise<SchoolSMSCredits> {
  const { data, error } = await supabaseClient
    .from('school_sms_credits')
    .select('*')
    .eq('school_id', schoolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  
  // If no record exists, create one
  if (!data) {
    const { data: newData, error: createError } = await supabaseClient
      .from('school_sms_credits')
      .insert({ school_id: schoolId })
      .select()
      .single()

    if (createError) throw createError
    return newData
  }

  return data
}

// Create SMS purchase request
export async function requestSMSBundle(
  supabaseClient: any,
  schoolId: string,
  bundleId: string,
  userId: string
): Promise<SMSTransaction> {
  // Get bundle details
  const { data: bundle, error: bundleError } = await supabaseClient
    .from('sms_bundles')
    .select('*')
    .eq('id', bundleId)
    .single()

  if (bundleError) throw bundleError

  // Create transaction
  const { data: transaction, error: txError } = await supabaseClient
    .from('sms_transactions')
    .insert({
      school_id: schoolId,
      bundle_id: bundleId,
      sms_count: bundle.sms_count,
      price_ksh: bundle.price_ksh,
      requested_by: userId,
      status: 'pending'
    })
    .select()
    .single()

  if (txError) throw txError
  return transaction
}

// Approve SMS transaction (Super Admin only)
export async function approveSMSTransaction(
  supabaseClient: any,
  transactionId: string,
  superAdminId: string
): Promise<SMSTransaction> {
  // Get transaction details
  const { data: transaction, error: txError } = await supabaseClient
    .from('sms_transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  if (txError) throw txError

  // Update credits
  const credits = await getSchoolSMSCredits(supabaseClient, transaction.school_id)
  
  const { error: creditError } = await supabaseClient
    .from('school_sms_credits')
    .update({
      balance: credits.balance + transaction.sms_count,
      total_purchased: credits.total_purchased + transaction.sms_count
    })
    .eq('school_id', transaction.school_id)

  if (creditError) throw creditError

  // Update transaction status
  const { data: updatedTx, error: updateError } = await supabaseClient
    .from('sms_transactions')
    .update({
      status: 'completed',
      approved_by: superAdminId,
      approved_at: new Date().toISOString()
    })
    .eq('id', transactionId)
    .select()
    .single()

  if (updateError) throw updateError
  return updatedTx
}

// Reject SMS transaction (Super Admin only)
export async function rejectSMSTransaction(
  supabaseClient: any,
  transactionId: string
): Promise<SMSTransaction> {
  const { data: transaction, error } = await supabaseClient
    .from('sms_transactions')
    .update({ status: 'cancelled' })
    .eq('id', transactionId)
    .select()
    .single()

  if (error) throw error
  return transaction
}

// Get school SMS transactions
export async function getSchoolSMSTransactions(
  supabaseClient: any,
  schoolId: string
): Promise<SMSTransaction[]> {
  const { data, error } = await supabaseClient
    .from('sms_transactions')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get all pending SMS transactions (Super Admin)
export async function getPendingSMSTransactions(
  supabaseClient: any
): Promise<SMSTransaction[]> {
  const { data, error } = await supabaseClient
    .from('sms_transactions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Deduct SMS credits after sending
export async function deductSMSCredits(
  supabaseClient: any,
  schoolId: string,
  smsCount: number
): Promise<void> {
  const credits = await getSchoolSMSCredits(supabaseClient, schoolId)

  if (credits.balance < smsCount) {
    throw new Error(`Insufficient SMS credits: need ${smsCount}, have ${credits.balance}`)
  }

  const { error } = await supabaseClient
    .from('school_sms_credits')
    .update({
      balance: credits.balance - smsCount,
      total_used: credits.total_used + smsCount
    })
    .eq('school_id', schoolId)

  if (error) throw error
}
