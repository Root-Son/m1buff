import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const dateParam = searchParams.get('date')
  
  try {
    const dateStr = dateParam || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .rpc('get_daily_stats_dynamic', {
        p_branch: branch,
        p_date: dateStr
      })

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    const result = data?.[0]

    return NextResponse.json({
      date: dateStr,
      branch,
      pickup: result?.pickup || 0,
      pickup_dod: result?.pickup_dod || 0,
      month1: result?.month1 || 0,
      month1_ci: result?.month1_ci || 0,
      month1_ci_dod: result?.month1_ci_dod || 0,
      month2: result?.month2 || 0,
      month2_ci: result?.month2_ci || 0,
      month2_ci_dod: result?.month2_ci_dod || 0,
      month3: result?.month3 || 0,
      month3_ci: result?.month3_ci || 0,
      month3_ci_dod: result?.month3_ci_dod || 0,
    })
  } catch (error: any) {
    console.error('Daily API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
