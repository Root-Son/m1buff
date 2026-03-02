import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'

  try {
    const result: any = {
      branch,
      feb: { pickup: 0, ci: 0 },
      mar: { pickup: 0, ci: 0 },
      apr: { pickup: 0, ci: 0 },
    }

    // 2월 픽업매출 (reservation_created_at이 2월인 것)
    let feb_pickup_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', '2026-02-01T00:00:00')
      .lte('reservation_created_at', '2026-02-28T23:59:59')

    if (branch !== 'all') {
      feb_pickup_query = feb_pickup_query.eq('branch_name', branch)
    }

    const { data: febPickupData } = await feb_pickup_query
    result.feb.pickup = febPickupData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 3월 픽업매출 (reservation_created_at이 3월인 것)
    let mar_pickup_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', '2026-03-01T00:00:00')
      .lte('reservation_created_at', '2026-03-31T23:59:59')

    if (branch !== 'all') {
      mar_pickup_query = mar_pickup_query.eq('branch_name', branch)
    }

    const { data: marPickupData } = await mar_pickup_query
    result.mar.pickup = marPickupData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 4월 픽업매출 (reservation_created_at이 4월인 것)
    let apr_pickup_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('reservation_created_at', '2026-04-01T00:00:00')
      .lte('reservation_created_at', '2026-04-30T23:59:59')

    if (branch !== 'all') {
      apr_pickup_query = apr_pickup_query.eq('branch_name', branch)
    }

    const { data: aprPickupData } = await apr_pickup_query
    result.apr.pickup = aprPickupData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 2월 C/I (check_in_date가 2월인 것, 전체 기간 reservation_created_at)
    let feb_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('check_in_date', '2026-02-01')
      .lte('check_in_date', '2026-02-28')

    if (branch !== 'all') {
      feb_ci_query = feb_ci_query.eq('branch_name', branch)
    }

    const { data: febCiData } = await feb_ci_query
    result.feb.ci = febCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 3월 C/I (check_in_date가 3월인 것)
    let mar_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('check_in_date', '2026-03-01')
      .lte('check_in_date', '2026-03-31')

    if (branch !== 'all') {
      mar_ci_query = mar_ci_query.eq('branch_name', branch)
    }

    const { data: marCiData } = await mar_ci_query
    result.mar.ci = marCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 4월 C/I (check_in_date가 4월인 것)
    let apr_ci_query = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('check_in_date', '2026-04-01')
      .lte('check_in_date', '2026-04-30')

    if (branch !== 'all') {
      apr_ci_query = apr_ci_query.eq('branch_name', branch)
    }

    const { data: aprCiData } = await apr_ci_query
    result.apr.ci = aprCiData?.reduce((sum, r) => sum + (r.payment_amount || 0), 0) || 0

    // 목표 가져오기
    const targetBranch = branch === 'all' ? '전지점' : branch

    const { data: targets } = await supabase
      .from('targets')
      .select('*')
      .ilike('branch_name', `%${targetBranch}%`)
      .in('month', [2, 3])

    const targetMap: Record<number, { target: number; base: number }> = {}
    targets?.forEach((t) => {
      targetMap[t.month] = {
        target: t.target_amount || 0,
        base: t.base_amount || 0,
      }
    })

    // 결과에 목표 추가
    result.feb.base = targetMap[2]?.base || 0
    result.feb.cumulative = result.feb.base + result.feb.ci
    result.feb.target = targetMap[2]?.target || 0
    result.feb.achievement_rate = result.feb.target
      ? result.feb.cumulative / result.feb.target
      : 0

    result.mar.base = targetMap[3]?.base || 0
    result.mar.cumulative = result.mar.base + result.mar.ci
    result.mar.target = targetMap[3]?.target || 0
    result.mar.achievement_rate = result.mar.target
      ? result.mar.cumulative / result.mar.target
      : 0

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
