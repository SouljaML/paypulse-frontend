const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('paypulse_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Types, matching the backend's Pydantic schemas exactly ----

export type MerchantStatus = 'pending_kyc' | 'active' | 'suspended'
export type KycDocStatus = 'submitted' | 'verified' | 'rejected'
export type ProviderStatus = 'active' | 'degraded' | 'disabled'
export type CommissionType = 'percentage' | 'flat' | 'percentage_plus_flat'
export type TransactionStatus =
  | 'initiated'
  | 'sent_to_provider'
  | 'pending_confirmation'
  | 'confirmed'
  | 'declined'
  | 'expired'
  | 'failed'

export interface Merchant {
  id: string
  legal_name: string
  trading_name: string
  registration_number: string
  status: MerchantStatus
  created_at: string
}

export interface KycDocument {
  id: string
  merchant_id: string
  doc_type: string
  file_reference: string
  status: KycDocStatus
  verified_by: string | null
  verified_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface Provider {
  id: string
  name: string
  adapter_key: string
  status: ProviderStatus
}

export interface CommissionRate {
  id: string
  provider_id: string
  commission_type: CommissionType
  percentage: string
  flat_fee: string
  effective_from: string
  effective_to: string | null
  set_by: string
  // Empty = a plain single rate; otherwise the bands decide and the three
  // fields above are ignored.
  tiers: CommissionTier[]
}

// One amount band: for amounts from min_amount through max_amount (both
// inclusive; max null = no upper limit) the provider charges provider_fee and
// PayPulse earns provider_fee * percentage + flat_fee. percentage is a
// fraction of the provider's fee (0.20 = 20%).
export interface CommissionTier {
  id: string
  min_amount: string
  max_amount: string | null
  provider_fee: string
  percentage: string
  flat_fee: string
}

export interface CommissionTierInput {
  min_amount: string
  max_amount: string | null
  provider_fee: string
  percentage: string
  flat_fee: string
}

export interface CommissionPreview {
  provider_id: string
  amount: string
  commission: string | null
  provider_fee: string | null
  rate_id: string | null
}

export interface CommissionSummary {
  provider_id: string
  provider_name: string
  total_commission: string
  transaction_count: number
}

export interface CommissionEntry {
  id: string
  transaction_id: string
  provider_id: string
  commission_rate_id: string
  entry_type: string
  amount: string
  provider_reported_amount: string | null
  reconciled_at: string | null
  created_at: string
}

export interface ProviderAccount {
  id: string
  // null = available to every shop of the merchant (the normal case)
  shop_id: string | null
  provider_adapter_key: string
  provider_name: string
  account_identifier: string
  is_active: boolean
  cached_balance: string | null
  balance_updated_at: string | null
}

export interface Balance {
  provider_adapter_key: string
  account_identifier: string
  // null when the provider can't report a balance (e.g. C-Pay)
  balance: string | null
  as_of: string | null
}

// ---- Auth ----

export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    let detail = 'Login failed'
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail)
  }
  const data = await res.json()
  return data.access_token as string
}

export interface DecodedToken {
  sub: string
  role: string
  merchant_id: string | null
  shop_id: string | null
  must_change_password?: boolean
  email?: string
  full_name?: string
  exp: number
}

export function decodeToken(token: string): DecodedToken {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

// ---- Merchants ----

export const listMerchants = () => request<Merchant[]>('/merchants')
export const getMerchant = (id: string) => request<Merchant>(`/merchants/${id}`)
export const listKycDocuments = (merchantId: string) =>
  request<KycDocument[]>(`/merchants/${merchantId}/kyc-documents`)
export const addKycDocument = (merchantId: string, doc_type: string, file_reference: string) =>
  request<KycDocument>(`/merchants/${merchantId}/kyc-documents`, {
    method: 'POST',
    body: JSON.stringify({ doc_type, file_reference }),
  })
export const approveKycDocument = (merchantId: string, docId: string) =>
  request<KycDocument>(`/merchants/${merchantId}/kyc-documents/${docId}/approve`, { method: 'POST' })
export const activateMerchant = (merchantId: string) =>
  request<Merchant>(`/merchants/${merchantId}/activate`, { method: 'POST' })
export const createMerchant = (legal_name: string, trading_name: string, registration_number: string) =>
  request<Merchant>('/merchants', {
    method: 'POST',
    body: JSON.stringify({ legal_name, trading_name, registration_number }),
  })
export const listProviderAccounts = (merchantId: string) =>
  request<ProviderAccount[]>(`/merchants/${merchantId}/provider-accounts`)
export const getBalances = (merchantId: string) => request<Balance[]>(`/merchants/${merchantId}/balances`)

// ---- Providers ----

export const listProviders = () => request<Provider[]>('/providers')
export const setProviderStatus = (providerId: string, status: ProviderStatus) =>
  request<Provider>(`/providers/${providerId}/status?status=${status}`, { method: 'PATCH' })

// ---- Commissions ----

export const getCurrentCommissionRate = (providerId: string) =>
  request<CommissionRate | null>(`/providers/${providerId}/commission-rate`)
export const listCommissionRateHistory = (providerId: string) =>
  request<CommissionRate[]>(`/providers/${providerId}/commission-rates`)
export const setCommissionRate = (
  providerId: string,
  commission_type: CommissionType,
  percentage: string,
  flat_fee: string,
) =>
  request<CommissionRate>(`/providers/${providerId}/commission-rate`, {
    method: 'PUT',
    body: JSON.stringify({ commission_type, percentage, flat_fee }),
  })
export const setCommissionTiers = (providerId: string, tiers: CommissionTierInput[]) =>
  request<CommissionRate>(`/providers/${providerId}/commission-tiers`, {
    method: 'PUT',
    body: JSON.stringify({ tiers }),
  })
export const previewCommission = (providerId: string, amount: string) =>
  request<CommissionPreview>(`/providers/${providerId}/commission-preview?amount=${encodeURIComponent(amount)}`)
export const getCommissionSummary = (providerId: string) =>
  request<CommissionSummary>(`/providers/${providerId}/commissions/summary`)
export const listCommissionEntries = (providerId: string) =>
  request<CommissionEntry[]>(`/providers/${providerId}/commission-entries`)

// ---- Merchant status / KYC reject ----

export const setMerchantStatus = (merchantId: string, status: 'active' | 'suspended') =>
  request<Merchant>(`/merchants/${merchantId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const rejectKycDocument = (merchantId: string, docId: string, reason: string) =>
  request<KycDocument>(`/merchants/${merchantId}/kyc-documents/${docId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

// ---- Providers: create ----

export const createProvider = (name: string, adapter_key: string) =>
  request<Provider>('/providers', {
    method: 'POST',
    body: JSON.stringify({ name, adapter_key }),
  })

// ---- Account settings ----

export const changePassword = (current_password: string, new_password: string) =>
  request<{ detail: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })

// ---- Team (platform staff) ----

export interface StaffUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
}

export const listStaffUsers = () => request<StaffUser[]>('/users')
export const createStaffUser = (email: string, password: string, full_name: string, role: string) =>
  request<StaffUser>('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name, role }),
  })
export const setStaffUserStatus = (userId: string, is_active: boolean) =>
  request<StaffUser>(`/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  })

// ---- Audit log ----

export interface AuditLogEntry {
  id: string
  actor_user_id: string | null
  actor_email: string | null
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
  created_at: string
}

export const listAuditLog = (targetType?: string) =>
  request<AuditLogEntry[]>(`/audit-log${targetType ? `?target_type=${targetType}` : ''}`)

// ---- Settlements ----

export interface Settlement {
  id: string
  merchant_id: string
  shop_id: string | null
  provider_id: string
  provider_name: string
  settlement_date: string
  opening_balance: string
  total_collections: string
  total_withdrawals: string
  total_fees: string
  provider_reported_closing_balance: string | null
  computed_closing_balance: string
  discrepancy: string
  created_at: string
}

export const listSettlements = (merchantId: string) =>
  request<Settlement[]>(`/merchants/${merchantId}/settlements`)

// ---- KYC document upload (real file, multipart — not the JSON text-reference version) ----

export async function uploadKycDocument(merchantId: string, docType: string, file: File): Promise<KycDocument> {
  const token = localStorage.getItem('paypulse_token')
  const form = new FormData()
  form.append('doc_type', docType)
  form.append('file', file)

  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc-documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form, // no Content-Type header — the browser sets the multipart boundary itself
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

// Auth-protected file download — a plain <a href> can't send the Authorization
// header, so this fetches the bytes and hands the browser a local blob URL to
// open instead.
export async function downloadKycDocumentFile(merchantId: string, docId: string, suggestedName: string) {
  const token = localStorage.getItem('paypulse_token')
  const res = await fetch(`${API_BASE}/merchants/${merchantId}/kyc-documents/${docId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---- Transactions (global monitoring for admins; own-merchant list otherwise) ----

export interface TransactionFilters {
  provider_id?: string
  shop_id?: string
  initiated_by?: string
  search?: string
  status?: TransactionStatus
  date_from?: string
  date_to?: string
}

export interface Transaction {
  id: string
  merchant_id: string
  shop_id: string | null
  shop_name: string | null
  provider_id: string
  type: 'collection' | 'withdrawal'
  status: TransactionStatus
  provider_reference: string | null
  amount: string
  currency: string
  customer_msisdn: string
  created_at: string
  confirmed_at: string | null
  decline_reason: string | null
}

export function listTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams()
  if (filters.provider_id) params.set('provider_id', filters.provider_id)
  if (filters.shop_id) params.set('shop_id', filters.shop_id)
  if (filters.initiated_by) params.set('initiated_by', filters.initiated_by)
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  const qs = params.toString()
  return request<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`)
}

// ---- Shops ----

export interface Shop {
  id: string
  merchant_id: string
  name: string
  location: string | null
  status: 'active' | 'suspended'
  created_at: string
}

export const listShops = (merchantId: string) => request<Shop[]>(`/merchants/${merchantId}/shops`)
export const createShop = (merchantId: string, name: string, location: string) =>
  request<Shop>(`/merchants/${merchantId}/shops`, {
    method: 'POST',
    body: JSON.stringify({ name, location: location || null }),
  })
export const setShopStatus = (merchantId: string, shopId: string, status: 'active' | 'suspended') =>
  request<Shop>(`/merchants/${merchantId}/shops/${shopId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
export const listShopProviderAccounts = (merchantId: string, shopId: string) =>
  request<ProviderAccount[]>(`/merchants/${merchantId}/shops/${shopId}/provider-accounts`)
// Provider accounts are set up once per merchant by PayPulse (platform admin);
// they then work in every shop and on every registered device.
export const createMerchantProviderAccount = (merchantId: string, providerAdapterKey: string, accountIdentifier: string) =>
  request<ProviderAccount>(`/merchants/${merchantId}/provider-accounts`, {
    method: 'POST',
    body: JSON.stringify({ provider_adapter_key: providerAdapterKey, account_identifier: accountIdentifier }),
  })
export const setProviderAccountActive = (merchantId: string, accountId: string, isActive: boolean) =>
  request<ProviderAccount>(`/merchants/${merchantId}/provider-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  })

// ---- Tills ----

export interface TillRecord {
  id: string
  merchant_id: string
  shop_id: string
  till_identifier: string
  label: string
  status: 'active' | 'blocked'
  blocked_reason: string | null
  created_at: string
  device_id: string | null
  device_reference: string | null
  device_label: string | null
  device_status: DeviceStatus | null
}

export const listTills = (merchantId: string) => request<TillRecord[]>(`/merchants/${merchantId}/tills`)
export const createTill = (merchantId: string, shopId: string, deviceId: string, label: string) =>
  request<TillRecord>(`/merchants/${merchantId}/tills`, {
    method: 'POST',
    body: JSON.stringify({ shop_id: shopId, device_id: deviceId, label }),
  })
export const setTillDevice = (merchantId: string, tillId: string, deviceId: string) =>
  request<TillRecord>(`/merchants/${merchantId}/tills/${tillId}/device`, {
    method: 'PUT',
    body: JSON.stringify({ device_id: deviceId }),
  })
export const setTillStatus = (merchantId: string, tillId: string, status: 'active' | 'blocked', reason?: string) =>
  request<TillRecord>(`/merchants/${merchantId}/tills/${tillId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason: reason ?? null }),
  })

// ---- Devices (owned by PayPulse; managed by platform admin) ----

export type DeviceStatus = 'pending' | 'active' | 'suspended' | 'revoked'

export interface DeviceRecord {
  id: string
  reference: string
  serial_number: string | null
  label: string
  status: DeviceStatus
  merchant_id: string | null
  merchant_name: string | null
  shop_id: string | null
  shop_name: string | null
  till_id: string | null
  till_label: string | null
  platform: string | null
  model: string | null
  os_version: string | null
  app_version: string | null
  created_at: string
  enrolled_at: string | null
  assigned_at: string | null
  last_seen_at: string | null
  suspended_at: string | null
  suspended_reason: string | null
  revoked_at: string | null
  revoked_reason: string | null
  enrollment_expires_at: string | null
}

// Returned once, when a device is added or its code is reissued.
export interface DeviceWithCode extends DeviceRecord {
  enrollment_code: string
}

const adminDevice = (id: string, action: string) => `/admin/devices/${id}/${action}`
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const adminListDevices = () => request<DeviceRecord[]>('/admin/devices')
export const adminAddDevice = (input: { label: string; serial_number?: string | null }) =>
  post<DeviceWithCode>('/admin/devices', input)
export const adminAssignDevice = (id: string, merchantId: string) =>
  post<DeviceRecord>(adminDevice(id, 'assign'), { merchant_id: merchantId })
export const adminUnassignDevice = (id: string) => post<DeviceRecord>(adminDevice(id, 'unassign'))
export const adminSuspendDevice = (id: string, reason: string) => post<DeviceRecord>(adminDevice(id, 'suspend'), { reason })
export const adminReinstateDevice = (id: string) => post<DeviceRecord>(adminDevice(id, 'reinstate'))
export const adminRevokeDevice = (id: string, reason: string) => post<DeviceRecord>(adminDevice(id, 'revoke'), { reason })
export const adminReissueDeviceCode = (id: string) => post<DeviceWithCode>(adminDevice(id, 'reissue-code'))

// Devices PayPulse has assigned to this merchant that aren't linked to a till yet.
export const listAvailableDevices = (merchantId: string) =>
  request<DeviceRecord[]>(`/merchants/${merchantId}/devices?available=true`)

// ---- Tellers ----

export interface Teller {
  id: string
  email: string
  full_name: string
  role: string
  shop_id: string | null
  is_active: boolean
  created_at: string
}

export const listTellers = (merchantId: string) => request<Teller[]>(`/merchants/${merchantId}/tellers`)
export const createTeller = (
  merchantId: string,
  email: string,
  password: string,
  fullName: string,
  role: string,
  shopId: string | null,
) =>
  request<Teller>(`/merchants/${merchantId}/tellers`, {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName, role, shop_id: shopId }),
  })
export const setTellerStatus = (merchantId: string, userId: string, isActive: boolean) =>
  request<Teller>(`/merchants/${merchantId}/tellers/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  })
export const assignTellerShop = (merchantId: string, userId: string, shopId: string | null) =>
  request<Teller>(`/merchants/${merchantId}/tellers/${userId}/shop`, {
    method: 'PATCH',
    body: JSON.stringify({ shop_id: shopId }),
  })

// ---- Create a transaction (the actual POS action) ----

export interface CreateTransactionInput {
  provider_adapter_key: string
  merchant_provider_account_id: string
  customer_msisdn: string
  amount: string
  idempotency_key: string
  device_id?: string
}

export const createTransaction = (input: CreateTransactionInput) =>
  request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(input) })

export const getTransaction = (transactionId: string) => request<Transaction>(`/transactions/${transactionId}`)

export const printReceipt = (transactionId: string) =>
  request<{ receipt_number: string; transaction: Transaction }>(`/transactions/${transactionId}/receipt`, {
    method: 'POST',
  })

// ---- Reset someone else's password (admin -> merchant users, owner -> tellers) ----

export interface ResetPasswordResult {
  email: string
  full_name: string
  role: string
  temporary_password: string
}

export const resetUserPassword = (email: string) =>
  request<ResetPasswordResult>('/auth/reset-user-password', { method: 'POST', body: JSON.stringify({ email }) })

// ---- Reports (platform admin) ----

export interface ReportMoneyStats {
  confirmed_count: number
  volume: string
  collections_volume: string
  withdrawals_volume: string
  commission: string
  uncommissioned_count: number
}
export interface ReportProviderRow extends ReportMoneyStats {
  provider_id: string
  provider_name: string
  current_rate: string | null
}
export interface ReportMerchantRow {
  merchant_id: string
  merchant_name: string
  confirmed_count: number
  volume: string
  commission: string
}
export interface ReportDayRow {
  day: string
  confirmed_count: number
  volume: string
  commission: string
}
export interface ReportOutcomes {
  confirmed: number
  declined: number
  failed: number
  expired: number
  pending: number
}
export interface ReportSummary {
  date_from: string
  date_to: string
  timezone: string
  currency: string
  totals: ReportMoneyStats
  by_provider: ReportProviderRow[]
  by_merchant: ReportMerchantRow[]
  by_day: ReportDayRow[]
  outcomes: ReportOutcomes
}

export const getReportSummary = (dateFrom: string, dateTo: string) =>
  request<ReportSummary>(`/reports/summary?date_from=${dateFrom}&date_to=${dateTo}`)
