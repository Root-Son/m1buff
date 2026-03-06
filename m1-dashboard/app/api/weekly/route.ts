import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')
  
  try {
    let startStr: string
    let endDate: string
    let end: Date
    
    if (startDateParam && endDateParam) {
      startStr = startDateParam
      endDate = endDateParam
      end = new Date(endDate)
    } else {
      const { data: latestData } = await supabase
        .from('raw_bookings')
        .select('reservation_created_at')
        .order('reservation_created_at', { ascending: false })
        .limit(1)
      
      endDate = latestData && latestData[0]
        ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      end = new Date(endDate)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      startStr = start.toISOString().split('T')[0]
    }

    // 주간 통계 (WoW 등)
    const { data, error } = await supabase
      .rpc('get_weekly_stats_dynamic', {
        p_branch: branch,
        p_start_date: startStr,
        p_end_date: endDate
      })

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    const result = data?.[0]

    // ✅ 날짜별 집계 함수 사용 (limit 없음!)
    const { data: dailyData, error: dailyError } = await supabase
      .rpc('get_daily_pickup', {
        p_branch: branch,
        p_start_date: startStr,
        p_end_date: endDate
      })

    if (dailyError) {
      console.error('Daily Pickup RPC Error:', dailyError)
      throw dailyError
    }

    // dailyData를 Map으로 변환
    const dailyMap: Record<string, any> = {}
    dailyData?.forEach((row: any) => {
      dailyMap[row.booking_date] = {
        pickup: row.total_pickup || 0,
        month1: row.month1_ci || 0,
        month2: row.month2_ci || 0,
        month3: row.month3_ci || 0
      }
    })

    // 7일 배열 생성
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(end)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]

      days.push({
        date: dateStr,
        day: dayName,
        ...dailyMap[dateStr] || { pickup: 0, month1: 0, month2: 0, month3: 0 },
      })
    }

    return NextResponse.json({
      branch,
      start_date: startStr,
      end_date: endDate,
      total_pickup: result?.total_pickup || 0,
      total_pickup_wow: result?.total_pickup_wow || 0,
      month1: result?.month1 || 0,
      month1_ci: result?.month1_ci || 0,
      month1_ci_wow: result?.month1_ci_wow || 0,
      month2: result?.month2 || 0,
      month2_ci: result?.month2_ci || 0,
      month2_ci_wow: result?.month2_ci_wow || 0,
      month3: result?.month3 || 0,
      month3_ci: result?.month3_ci || 0,
      month3_ci_wow: result?.month3_ci_wow || 0,
      days
    })
  } catch (error: any) {
    console.error('Weekly API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
