import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  
  try {
    // 최신 데이터 날짜 가져오기
    const { data: latestData } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)
    
    const endDate = latestData && latestData[0]
      ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // 7일 전 날짜
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const startStr = start.toISOString().split('T')[0]

    // 7일간 전체 픽업매출
    let pickup_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)

    if (branch !== 'all') {
      pickup_query = pickup_query.eq('branch_name', branch)
    }

    const { data: pickupData } = await pickup_query
    const totalPickup = pickupData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 7일간 2월 C/I
    let feb_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)
      .gte('check_in_date', '2026-02-01')
      .lte('check_in_date', '2026-02-28')

    if (branch !== 'all') {
      feb_ci_query = feb_ci_query.eq('branch_name', branch)
    }

    const { data: febCiData } = await feb_ci_query
    const totalFebCi = febCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 7일간 3월 C/I
    let mar_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)
      .gte('check_in_date', '2026-03-01')
      .lte('check_in_date', '2026-03-31')

    if (branch !== 'all') {
      mar_ci_query = mar_ci_query.eq('branch_name', branch)
    }

    const { data: marCiData } = await mar_ci_query
    const totalMarCi = marCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 7일간 4월 C/I
    let apr_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)
      .gte('check_in_date', '2026-04-01')
      .lte('check_in_date', '2026-04-30')

    if (branch !== 'all') {
      apr_ci_query = apr_ci_query.eq('branch_name', branch)
    }

    const { data: aprCiData } = await apr_ci_query
    const totalAprCi = aprCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 일별 데이터 (차트용)
    let daily_query = supabase
      .from('raw_bookings')
      .select('reservation_created_at, payment_amount, check_in_date')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)

    if (branch !== 'all') {
      daily_query = daily_query.eq('branch_name', branch)
    }

    const { data: dailyData } = await daily_query

    // 날짜별 집계
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
        ...dailyMap[dateStr] || { pickup: 0, feb: 0, mar: 0, apr: 0 },
      })
    }

    return NextResponse.json({
      branch,
      start_date: startStr,
      end_date: endDate,
      total_pickup: totalPickup,
      total_feb_ci: totalFebCi,
      total_mar_ci: totalMarCi,
      total_apr_ci: totalAprCi,
      days,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
