import { getSupabase } from '../lib/supabase'
import type { AdminCustomerRow, AdminLoyaltyTransaction } from '../types'

export const adminListCustomers = async (
  search?: string,
  limit = 50,
  offset = 0,
): Promise<AdminCustomerRow[]> => {
  const client = getSupabase()
  const { data, error } = await client.rpc('admin_list_customers', {
    p_search: search?.trim() || null,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data as AdminCustomerRow[]) ?? []
}

export const adminAdjustPoints = async (
  customerId: string,
  amount: number,
  reason?: string,
): Promise<number> => {
  const client = getSupabase()
  const { data, error } = await client.rpc('admin_adjust_points', {
    p_customer_id: customerId,
    p_amount: amount,
    p_reason: reason?.trim() || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data as number) ?? 0
}

export const adminCustomerHistory = async (
  customerId: string,
  limit = 100,
): Promise<AdminLoyaltyTransaction[]> => {
  const client = getSupabase()
  const { data, error } = await client.rpc('admin_customer_history', {
    p_customer_id: customerId,
    p_limit: limit,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data as AdminLoyaltyTransaction[]) ?? []
}
