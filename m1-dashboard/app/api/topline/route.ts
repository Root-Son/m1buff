import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const month = parseInt(searchParams.get('month') || '3')

  try {
    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_topline_weekly_checkin', {
        p_branch: branch,
        p_month: month,
        p_year: 2026
      })

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    // 응답 포맷
    const weeks = data?.map((week: any) => {
      const start = new Date(week.start_date)
      const end = new Date(week.end_date)
      
      return {
        week_num: week.week_num,
        start_date: week.start_date,
        end_date: week.end_date,
        label: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
        ci_amount: week.ci_amount || 0,
      }
    }) || []

    return NextResponse.json({
      branch,
      month,
      weeks,
    })
  } catch (error: any) {
    console.error('Topline API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
