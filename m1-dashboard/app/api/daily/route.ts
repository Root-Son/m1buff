import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  
  try {
    // 최신 데이터 날짜 가져오기
    const { data: latestData } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)
    
    const date = latestData && latestData[0] 
      ? new Date(latestData[0].reservation_created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    // RPC 함수 호출
    const { data, error } = await supabase
      .rpc('get_daily_stats', {
        p_branch: branch,
        p_date: date
      })

    if (error) throw error

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
      pickup: data?.[0]?.pickup || 0,
      feb_ci: data?.[0]?.feb_ci || 0,
      mar_ci: data?.[0]?.mar_ci || 0,
      apr_ci: data?.[0]?.apr_ci || 0,
      occ_improvement,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
