import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function normalizeBranchName(name: string): string {
  if (name === "호텔 동탄") return "동탄점(호텔)"
  if (name === "웨이브파크_펜트") return "웨이브파크점"
  return name
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawBranch = searchParams.get('branch') || 'all'
  const branch = rawBranch === 'all' ? 'all' : normalizeBranchName(rawBranch)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    // 오늘 날짜 예약 데이터
    const { data: allData, error } = await supabase
      .from('raw_bookings')
      .select('payment_amount, check_in_date, branch_name')
      .gte('reservation_created_at', `${date}T00:00:00`)
      .lt('reservation_created_at', `${date}T23:59:59`)

    if (error) throw error

    // 지점명 정규화 후 필터링
    const data = branch === 'all' 
      ? allData 
      : allData?.filter(row => normalizeBranchName(row.branch_name) === branch)

    // 집계
    const result = {
      date,
      branch,
      pickup: 0,
      feb_ci: 0,
      mar_ci: 0,
      apr_ci: 0,
    }

    data?.forEach((row) => {
      const amount = row.payment_amount || 0
      result.pickup += amount

      const checkinDate = new Date(row.check_in_date)
      const month = checkinDate.getMonth() + 1

      if (month === 2) result.feb_ci += amount
      else if (month === 3) result.mar_ci += amount
      else if (month === 4) result.apr_ci += amount
    })

    // OCC 개선률 (해당 날짜의 평균)
    const { data: occData } = await supabase
      .from('branch_room_occ')
      .select('occ_asof, occ_1d_ago')
      .eq('date', date)

    let occ_improvement = 0
    if (occData && occData.length > 0) {
      const avgOcc = occData.reduce((sum, r) => sum + (r.occ_asof || 0), 0) / occData.length
      const avgOccD1 = occData.reduce((sum, r) => sum + (r.occ_1d_ago || 0), 0) / occData.length
      occ_improvement = avgOcc - avgOccD1
    }

    return NextResponse.json({
      ...result,
      occ_improvement,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
