import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'

  try {
    // 2월 데이터
    const { data: febData, error: febError } = await supabase
      .rpc('get_monthly_pickup', {
        p_branch: branch,
        p_month: 2
      })

    if (febError) throw febError

    // 3월 데이터
    const { data: marData, error: marError } = await supabase
      .rpc('get_monthly_pickup', {
        p_branch: branch,
        p_month: 3
      })

    if (marError) throw marError

    // 4월 데이터
    const { data: aprData, error: aprError } = await supabase
      .rpc('get_monthly_pickup', {
        p_branch: branch,
        p_month: 4
      })

    if (aprError) throw aprError

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

    const result = {
      branch,
      feb: {
        pickup: febData?.[0]?.pickup || 0,
        ci: febData?.[0]?.ci || 0,
        base: targetMap[2]?.base || 0,
        cumulative: (targetMap[2]?.base || 0) + (febData?.[0]?.ci || 0),
        target: targetMap[2]?.target || 0,
        achievement_rate: targetMap[2]?.target
          ? ((targetMap[2].base || 0) + (febData?.[0]?.ci || 0)) / targetMap[2].target
          : 0,
      },
      mar: {
        pickup: marData?.[0]?.pickup || 0,
        ci: marData?.[0]?.ci || 0,
        base: targetMap[3]?.base || 0,
        cumulative: (targetMap[3]?.base || 0) + (marData?.[0]?.ci || 0),
        target: targetMap[3]?.target || 0,
        achievement_rate: targetMap[3]?.target
          ? ((targetMap[3].base || 0) + (marData?.[0]?.ci || 0)) / targetMap[3].target
          : 0,
      },
      apr: {
        pickup: aprData?.[0]?.pickup || 0,
        ci: aprData?.[0]?.ci || 0,
      },
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
