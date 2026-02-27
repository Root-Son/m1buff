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
  occ_asof: number
  occ_1d_ago: number
  occ_7d_ago: number
  adr: number
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
