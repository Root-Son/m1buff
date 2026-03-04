import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')
  
  try {
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

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

    return NextResponse.json({
      branch,
      month,
      pickup: result?.pickup || 0,
      pickup_mom: result?.pickup_mom || 0,
      month1: result?.month1 || 0,
      month1_ci: result?.month1_ci || 0,
      month1_ci_mom: result?.month1_ci_mom || 0,
      month2: result?.month2 || 0,
      month2_ci: result?.month2_ci || 0,
      month2_ci_mom: result?.month2_ci_mom || 0,
      month3: result?.month3 || 0,
      month3_ci: result?.month3_ci || 0,
      month3_ci_mom: result?.month3_ci_mom || 0,
    })
  } catch (error: any) {
    console.error('Monthly API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
