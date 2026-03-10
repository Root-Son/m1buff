import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 타입 정의
export type RawBooking = {
  id: string
  reservation_no: string
  branch_name: string
  room_type: string
  reservation_created_at: string
  check_in_date: string
  payment_amount: number
}

export type BranchRoomOcc = {
  id: string
  date: string
  branch_name: string
  room_type: string
  available_rooms: number
  sold_rooms: number
  blocked_rooms: number
  occ: number
  occ_asof: number
  occ_1d_ago: number
  occ_7d_ago: number
  delta_1d_pp: number
  delta_7d_pp: number
  adr: number
  revenue: number
  rev_par: number
}

// 스마트 가격 추천 타입
export type PricingRecommendation = {
  branch_name: string
  room_type: string
  date: string
  remaining_rooms: number
  available_rooms: number
  total_rooms: number
  lead_time_days: number
  set_price: number | null
  guardrail_price: number | null
  price_diff_pct: number | null
  occ: number
  occ_1d_ago: number
  occ_7d_ago: number
  delta_1d_pp: number
  delta_7d_pp: number
  sales_pace: 'fast' | 'normal' | 'slow' | 'sold_out'
  sales_pace_detail: string
  action: 'price_down' | 'price_up' | 'monitor'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  message: string
  suggested_price: number | null
  // 과거 벤치마크 대비 페이스 정보
  expected_occ: number | null       // 해당 리드타임의 역사적 기대 OCC (0-1)
  expected_final_occ: number | null // 역사적 최종 OCC (D-1 기준, 0-1)
  pace_vs_benchmark: 'ahead' | 'normal' | 'behind' | null  // 벤치마크 대비 빠름/보통/느림
}

export type ExecutiveSummary = {
  total_items: number
  price_down_count: number
  price_up_count: number
  monitor_count: number
  critical_count: number
  total_rooms_at_risk: number
  top_urgent_branches: string[]
}

export type PriceGuide = {
  id: string
  date: string
  branch_name: string
  room_type: string
  min_price: number
}

export type YoloPrice = {
  id: string
  date: string
  branch_name: string
  room_type: string
  price: number
}

export type Target = {
  id: string
  branch_name: string
  month: number
  year: number
  target_amount: number
  base_amount: number
}
