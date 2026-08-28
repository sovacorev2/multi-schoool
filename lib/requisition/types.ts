// Types for the requisitions feature only - kept separate from lib/types.ts
// since that file describes the exam system's own domain model.

export interface RequisitionProfile {
  id: string
  email: string
  full_name: string
  is_approver: boolean
  created_at: string
}

export type RequisitionType = 'goods' | 'cash'
export type RequisitionStatus = 'pending' | 'approved' | 'rejected'
export type PaymentMethod = 'bank' | 'mobile_money' | 'cash'

export interface RequisitionItem {
  id: string
  requisition_id: string
  description: string
  quantity: number
  unit_cost: number
}

export interface PaymentDetails {
  bank_name?: string
  account_number?: string
  account_name?: string
  phone_number?: string
  recipient_name?: string
}

export interface Requisition {
  id: string
  requester_id: string
  type: RequisitionType
  title: string
  description: string
  amount: number
  status: RequisitionStatus
  remarks: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  payment_method: PaymentMethod | null
  payment_details: PaymentDetails | null
  requester?: RequisitionProfile
  decider?: RequisitionProfile
  items?: RequisitionItem[]
}
