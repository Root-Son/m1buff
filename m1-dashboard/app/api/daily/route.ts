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
    
    const date = latestData && latestData[0] 
      ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // 다음날 계산
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().split('T')[0]

    const result = {
      date,
      branch,
      pickup: 0,
      feb_ci: 0,
      mar_ci: 0,
      apr_ci: 0,
      occ_improvement: 0,
    }

    // 오늘 픽업매출
    let pickup_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', date)
      .lt('reservation_created_at', nextDayStr)

    if (branch !== 'all') {
      pickup_query = pickup_query.eq('branch_name', branch)
    }

    const { data: pickupData } = await pickup_query
    result.pickup = pickupData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 오늘 2월 C/I
    let feb_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', date)
      .lt('reservation_created_at', nextDayStr)
      .gte('check_in_date', '2026-02-01')
      .lt('check_in_date', '2026-03-01')

    if (branch !== 'all') {
      feb_ci_query = feb_ci_query.eq('branch_name', branch)
    }

    const { data: febCiData } = await feb_ci_query
    result.feb_ci = febCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 오늘 3월 C/I
    let mar_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', date)
      .lt('reservation_created_at', nextDayStr)
      .gte('check_in_date', '2026-03-01')
      .lt('check_in_date', '2026-04-01')

    if (branch !== 'all') {
      mar_ci_query = mar_ci_query.eq('branch_name', branch)
    }

    const { data: marCiData } = await mar_ci_query
    result.mar_ci = marCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 오늘 4월 C/I
    let apr_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', date)
      .lt('reservation_created_at', nextDayStr)
      .gte('check_in_date', '2026-04-01')
      .lt('check_in_date', '2026-05-01')

    if (branch !== 'all') {
      apr_ci_query = apr_ci_query.eq('branch_name', branch)
    }

    const { data: aprCiData } = await apr_ci_query
    result.apr_ci = aprCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // OCC 개선률
    let occ_query = supabase
      .from('branch_room_occ')
      .select('occ_asof, occ_1d_ago')
      .eq('date', date)

    if (branch !== 'all') {
      occ_query = occ_query.eq('branch_name', branch)
    }

    const { data: occData } = await occ_query

    if (occData && occData.length > 0) {
      const avgOcc = occData.reduce((sum, r) => sum + (r.occ_asof || 0), 0) / occData.length
      const avgOccD1 = occData.reduce((sum, r) => sum + (r.occ_1d_ago || 0), 0) / occData.length
      result.occ_improvement = avgOcc - avgOccD1
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
