// 임시 디버그 API - 강남예전로이움점 4월 W2 일별 데이터
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('branch_room_occ')
    .select('date, room_type, available_rooms, sold_rooms, revenue')
    .eq('branch_name', '강남예전로이움점')
    .gte('date', '2026-04-08')
    .lte('date', '2026-04-14')
    .order('date')
    .order('room_type')

  if (error) return NextResponse.json({ error })

  // 일별 합산
  const daily: Record<string, any> = {}
  data?.forEach(r => {
    if (!daily[r.date]) daily[r.date] = { avail: 0, sold: 0, rev: 0 }
    daily[r.date].avail += r.available_rooms || 0
    daily[r.date].sold += r.sold_rooms || 0
    daily[r.date].rev += r.revenue || 0
  })

  const result = Object.entries(daily).map(([date, d]: any) => {
    const day = new Date(date).getDay()
    return {
      date,
      dayName: ['일','월','화','수','목','금','토'][day],
      isWeekend: day === 5 || day === 6,
      avail: d.avail,
      sold: d.sold,
      rev: d.rev,
      adr: d.sold > 0 ? Math.round(d.rev / d.sold) : 0,
      occ: d.avail > 0 ? Math.round(d.sold / d.avail * 1000) / 10 : 0,
    }
  })

  return NextResponse.json({ raw_count: data?.length, daily: result })
}
