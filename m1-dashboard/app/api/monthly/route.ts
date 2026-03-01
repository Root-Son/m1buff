import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'

  try {
    // 월별 픽업매출 (reservation_created_at 기준)
    let pickupQuery = supabase
      .from('raw_bookings')
      .select('reservation_created_at, payment_amount')

    if (branch !== 'all') {
      pickupQuery = pickupQuery.eq('branch_name', branch)
    }

    const { data: pickupData, error: pickupError } = await pickupQuery

    if (pickupError) throw pickupError

    // 월별 픽업 집계
    const monthlyPickup: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

    pickupData?.forEach((row) => {
      const createdDate = new Date(row.reservation_created_at)
      const month = createdDate.getMonth() + 1

      if (month >= 1 && month <= 4) {
        monthlyPickup[month] += row.payment_amount || 0
      }
    })

    // 월별 체크인 매출 (check_in_date 기준, 전체 기간)
    let ciQuery = supabase
      .from('raw_bookings')
      .select('payment_amount, check_in_date')

    if (branch !== 'all') {
      ciQuery = ciQuery.eq('branch_name', branch)
    }

    const { data: ciData, error: ciError } = await ciQuery

    if (ciError) throw ciError

    // 월별 CI 집계
    const monthlyCi: Record<number, number> = { 2: 0, 3: 0, 4: 0 }

    ciData?.forEach((row) => {
      const checkinDate = new Date(row.check_in_date)
      const month = checkinDate.getMonth() + 1

      if (month >= 2 && month <= 4) {
        monthlyCi[month] += row.payment_amount || 0
      }
    })

    // 목표 가져오기
    const targetBranch = branch === 'all' ? '2월 전지점' : branch

    const { data: targets } = await supabase
      .from('targets')
      .select('*')
      .like('branch_name', `%${targetBranch}%`)
      .in('month', [2, 3])

    const targetMap: Record<number, { target: number; base: number }> = {}
    targets?.forEach((t) => {
      targetMap[t.month] = {
        target: t.target_amount || 0,
        base: t.base_amount || 0,
      }
    })

    // 결과
    const result = {
      branch,
      feb: {
        pickup: monthlyPickup[2],
        ci: monthlyCi[2],
        base: targetMap[2]?.base || 0,
        cumulative: (targetMap[2]?.base || 0) + monthlyCi[2],
        target: targetMap[2]?.target || 0,
        achievement_rate: targetMap[2]?.target
          ? ((targetMap[2].base + monthlyCi[2]) / targetMap[2].target)
          : 0,
      },
      mar: {
        pickup: monthlyPickup[3],
        ci: monthlyCi[3],
        base: targetMap[3]?.base || 0,
        cumulative: (targetMap[3]?.base || 0) + monthlyCi[3],
        target: targetMap[3]?.target || 0,
        achievement_rate: targetMap[3]?.target
          ? ((targetMap[3].base + monthlyCi[3]) / targetMap[3].target)
          : 0,
      },
      apr: {
        pickup: monthlyPickup[4],
        ci: monthlyCi[4],
      },
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
