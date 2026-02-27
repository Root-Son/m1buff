import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'

  try {
    // 전체 체크인 매출 집계
    let query = supabase
      .from('raw_bookings')
      .select('payment_amount, check_in_date')

    if (branch !== 'all') {
      query = query.eq('branch_name', branch)
    }

    const { data, error } = await query

    if (error) throw error

    // 월별 집계
    const monthly = { 2: 0, 3: 0, 4: 0 }

    data?.forEach((row) => {
      const checkinDate = new Date(row.check_in_date)
      const month = checkinDate.getMonth() + 1

      if (month >= 2 && month <= 4) {
        monthly[month as 2 | 3 | 4] += row.payment_amount || 0
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
        ci: monthly[2],
        base: targetMap[2]?.base || 0,
        cumulative: (targetMap[2]?.base || 0) + monthly[2],
        target: targetMap[2]?.target || 0,
        achievement_rate: targetMap[2]?.target
          ? ((targetMap[2].base + monthly[2]) / targetMap[2].target)
          : 0,
      },
      mar: {
        ci: monthly[3],
        base: targetMap[3]?.base || 0,
        cumulative: (targetMap[3]?.base || 0) + monthly[3],
        target: targetMap[3]?.target || 0,
        achievement_rate: targetMap[3]?.target
          ? ((targetMap[3].base + monthly[3]) / targetMap[3].target)
          : 0,
      },
      apr: {
        ci: monthly[4],
      },
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
