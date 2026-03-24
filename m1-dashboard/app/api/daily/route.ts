import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const dateParam = searchParams.get('date')
  
  try {
    const dateStr = dateParam || new Date().toISOString().split('T')[0]

    // 전주 동요일 (7일 전)
    const d = new Date(dateStr)
    d.setDate(d.getDate() - 7)
    const lastWeekStr = d.toISOString().split('T')[0]

    // 오늘 + 전주 동요일 병렬 호출
    const [todayResult, lastWeekResult] = await Promise.all([
      supabase.rpc('get_daily_stats_dynamic', { p_branch: branch, p_date: dateStr }),
      supabase.rpc('get_daily_stats_dynamic', { p_branch: branch, p_date: lastWeekStr }),
    ])

    if (todayResult.error) throw todayResult.error

    const today = todayResult.data?.[0]
    const lastWeek = lastWeekResult.data?.[0]

    const wow = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : 0

    return NextResponse.json({
      date: dateStr,
      compare_date: lastWeekStr,
      branch,
      pickup: today?.pickup || 0,
      pickup_wow: wow(today?.pickup || 0, lastWeek?.pickup || 0),
      month1: today?.month1 || 0,
      month1_ci: today?.month1_ci || 0,
      month1_ci_wow: wow(today?.month1_ci || 0, lastWeek?.month1_ci || 0),
      month2: today?.month2 || 0,
      month2_ci: today?.month2_ci || 0,
      month2_ci_wow: wow(today?.month2_ci || 0, lastWeek?.month2_ci || 0),
      month3: today?.month3 || 0,
      month3_ci: today?.month3_ci || 0,
      month3_ci_wow: wow(today?.month3_ci || 0, lastWeek?.month3_ci || 0),
    })
  } catch (error: any) {
    console.error('Daily API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
