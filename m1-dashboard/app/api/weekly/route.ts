import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  
  try {
    // 최신 데이터 날짜
    const { data: latestData } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)
    
    const endDate = latestData && latestData[0]
      ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // 7일 전
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const startStr = start.toISOString().split('T')[0]

    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_weekly_stats', {
        p_branch: branch,
        p_start_date: startStr,
        p_end_date: endDate
      })

    if (error) throw error

    // 일별 데이터 (차트용)
    let daily_query = supabase
      .from('raw_bookings')
      .select('reservation_created_at, payment_amount, check_in_date')
      .gte('reservation_created_at', startStr)
      .lte('reservation_created_at', endDate)

    if (branch !== 'all') {
      daily_query = daily_query.eq('branch_name', branch)
    }

    const { data: dailyData } = await daily_query

    const dailyMap: Record<string, { pickup: number; feb: number; mar: number; apr: number }> = {}

    dailyData?.forEach((row) => {
      const createdDate = new Date(row.reservation_created_at)
      const dateKey = createdDate.toISOString().split('T')[0]

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { pickup: 0, feb: 0, mar: 0, apr: 0 }
      }

      const amount = row.payment_amount || 0
      dailyMap[dateKey].pickup += amount

      const checkinDate = new Date(row.check_in_date)
      const month = checkinDate.getMonth() + 1

      if (month === 2) dailyMap[dateKey].feb += amount
      else if (month === 3) dailyMap[dateKey].mar += amount
      else if (month === 4) dailyMap[dateKey].apr += amount
    })

    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(end)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]

      days.push({
        date: dateStr,
        day: dayName,
        ...dailyMap[dateStr] || { pickup: 0, feb: 0, mar: 0, apr: 0 },
      })
    }

    return NextResponse.json({
      branch,
      start_date: startStr,
      end_date: endDate,
      total_pickup: data?.[0]?.total_pickup || 0,
      total_feb_ci: data?.[0]?.total_feb_ci || 0,
      total_mar_ci: data?.[0]?.total_mar_ci || 0,
      total_apr_ci: data?.[0]?.total_apr_ci || 0,
      days,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
