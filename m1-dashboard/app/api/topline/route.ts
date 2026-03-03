import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const month = parseInt(searchParams.get('month') || '2')

  try {
    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_topline_checkin', {
        p_branch: branch,
        p_month: month
      })

    if (error) throw error

    const result = data?.[0]

    // 당월 목표 가져오기
    const targetBranch = branch === 'all' ? '전지점' : branch
    const { data: targets } = await supabase
      .from('targets')
      .select('*')
      .ilike('branch_name', `%${targetBranch}%`)
      .eq('month', month)

    let target = 0
    let base = 0
    if (targets && targets.length > 0) {
      target = targets[0].target_amount || 0
      base = targets[0].base_amount || 0
    }

    // 달성률 계산
    const cumulative = base + (result?.current_month_ci || 0)
    const achievement_rate = target ? cumulative / target : 0

    return NextResponse.json({
      branch,
      month,
      prev_month: result?.prev_month || 0,
      prev_month_ci: result?.prev_month_ci || 0,
      current_month: result?.current_month || 0,
      current_month_ci: result?.current_month_ci || 0,
      next_month: result?.next_month || 0,
      next_month_ci: result?.next_month_ci || 0,
      next_next_month: result?.next_next_month || 0,
      next_next_month_ci: result?.next_next_month_ci || 0,
      base,
      target,
      cumulative,
      achievement_rate,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
