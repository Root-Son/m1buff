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

    let daily_query = supabase
      .from('raw_bookings')
      .select('reservation_created_at, payment_amount, check_in_date')
      .gte('reservation_created_at', startStr + ' 00:00:00')
      .lte('reservation_created_at', endDate + ' 23:59:59')
      .limit(10000)  // ✅ limit 명시적으로 증가

    if (branch !== 'all') {
      daily_query = daily_query.eq('branch_name', branch)
    }

    const { data: dailyData } = await daily_query

    // 🔍 DEBUG: 데이터 개수 확인
    console.log('📊 Daily data count:', dailyData?.length)
    console.log('📅 Date range:', startStr, 'to', endDate)

    const dailyMap: Record<string, { pickup: number; month1: number; month2: number; month3: number }> = {}
    const startMonth = new Date(startStr).getMonth() + 1

    dailyData?.forEach((row) => {
      const createdDate = new Date(row.reservation_created_at)
      const year = createdDate.getFullYear()
      const month = String(createdDate.getMonth() + 1).padStart(2, '0')
      const day = String(createdDate.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`

      // 🔍 DEBUG: 처음 5개만 로그
      if (Object.keys(dailyMap).length < 5) {
        console.log('🔑 Date key:', dateKey, 'Amount:', row.payment_amount)
      }

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { pickup: 0, month1: 0, month2: 0, month3: 0 }
      }

      const amount = row.payment_amount || 0
      dailyMap[dateKey].pickup += amount

      const checkinMonth = new Date(row.check_in_date).getMonth() + 1

      if (checkinMonth === startMonth) {
        dailyMap[dateKey].month1 += amount
      } else if (checkinMonth === (startMonth % 12) + 1) {
        dailyMap[dateKey].month2 += amount
      } else if (checkinMonth === ((startMonth + 1) % 12) + 1) {
        dailyMap[dateKey].month3 += amount
      }
    })

    // 🔍 DEBUG: dailyMap 확인
    console.log('🗺️ DailyMap keys:', Object.keys(dailyMap))

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
      days,
      debug_daily_count: dailyData?.length,
      debug_map_keys: Object.keys(dailyMap)
    })
  } catch (error: any) {
    console.error('Weekly API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
