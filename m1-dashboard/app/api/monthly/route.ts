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
  const endDate = searchParams.get('date') || new Date().toISOString().split('T')[0]

  try {
    // 7일 전 날짜 계산
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)

    const startStr = start.toISOString().split('T')[0]

    // 데이터 가져오기
    const { data: allData, error } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at, payment_amount, check_in_date, branch_name')
      .gte('reservation_created_at', `${startStr}T00:00:00`)
      .lte('reservation_created_at', `${endDate}T23:59:59`)

    if (error) throw error

    // 지점명 정규화 후 필터링
    const data = branch === 'all' 
      ? allData 
      : allData?.filter(row => normalizeBranchName(row.branch_name) === branch)

    // 날짜별 집계
    const dailyMap: Record<string, { pickup: number; feb: number; mar: number; apr: number }> = {}

    data?.forEach((row) => {
      const createdDate = new Date(row.reservation_created_at)
      const dateKey = createdDate.toISOString().split('T')[0]

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { pickup: 0, feb: 0, mar: 0, apr: 0 }
      }

      const amount = row.payment_amount || 0
      dailyMap[dateKey].pickup += amount

      const checkinDate = new Date(row.check_in_date)
      const month = checkinDate.getMonth() + 1

      if (month === 2) dailyMap[dateKey].feb += amount
      else if (month === 3) dailyMap[dateKey].mar += amount
      else if (month === 4) dailyMap[dateKey].apr += amount
    })

    // 7일 배열 생성
    const result = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(end)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]

      result.push({
        date: dateStr,
        day: dayName,
        ...dailyMap[dateStr] || { pickup: 0, feb: 0, mar: 0, apr: 0 },
      })
    }

    return NextResponse.json({
      branch,
      start_date: startStr,
      end_date: endDate,
      days: result,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
