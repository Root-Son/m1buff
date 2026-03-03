import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const month = parseInt(searchParams.get('month') || '2')

  try {
    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_monthly_stats_dynamic', {
        p_branch: branch,
        p_month: month
      })

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    const result = data?.[0]

    // 목표 가져오기
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

    return NextResponse.json({
      branch,
      month,
      pickup: result?.pickup || 0,
      month1: result?.month1 || 0,
      month1_ci: result?.month1_ci || 0,
      month2: result?.month2 || 0,
      month2_ci: result?.month2_ci || 0,
      month3: result?.month3 || 0,
      month3_ci: result?.month3_ci || 0,
      base,
      target,
    })
  } catch (error: any) {
    console.error('Monthly API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
