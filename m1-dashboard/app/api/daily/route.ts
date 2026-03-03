import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const dateParam = searchParams.get('date')
  
  try {
    // 날짜 파라미터가 있으면 사용, 없으면 최신 데이터 날짜
    let date: string
    
    if (dateParam) {
      date = dateParam
    } else {
      const { data: latestData } = await supabase
        .from('raw_bookings')
        .select('reservation_created_at')
        .order('reservation_created_at', { ascending: false })
        .limit(1)
      
      date = latestData && latestData[0] 
        ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    }

    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_daily_stats_dynamic', {
        p_branch: branch,
        p_date: date
      })

    if (error) throw error

    const result = data?.[0]

    // OCC 개선률
    let occ_query = supabase
      .from('branch_room_occ')
      .select('occ_asof, occ_1d_ago')
      .eq('date', date)

    if (branch !== 'all') {
      occ_query = occ_query.eq('branch_name', branch)
    }

    const { data: occData } = await occ_query

    let occ_improvement = 0
    if (occData && occData.length > 0) {
      const avgOcc = occData.reduce((sum, r) => sum + (r.occ_asof || 0), 0) / occData.length
      const avgOccD1 = occData.reduce((sum, r) => sum + (r.occ_1d_ago || 0), 0) / occData.length
      occ_improvement = avgOcc - avgOccD1
    }

    return NextResponse.json({
      date,
      branch,
      pickup: result?.pickup || 0,
      month1: result?.month1 || 0,
      month1_ci: result?.month1_ci || 0,
      month2: result?.month2 || 0,
      month2_ci: result?.month2_ci || 0,
      month3: result?.month3 || 0,
      month3_ci: result?.month3_ci || 0,
      occ_improvement,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
