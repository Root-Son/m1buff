import { NextRequest, NextResponse } from 'next/server'
import { duckQuery } from '@/lib/duck'

// 픽업 코호트: 매일 팔린 픽업이 어느 체크인 주차로 떨어졌는지
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
  const year = 2026

  try {
    const escapedBranch = branch.replace(/'/g, "''")
    const channel = searchParams.get('channel') || 'all' // 'all' or 'ota'
    const branchFilter = branch !== 'all' ? `AND b_name = '${escapedBranch}'` : ''
    const OTA_CHANNELS = ['야놀자(호텔)', '야놀자(모텔)', '아고다', '여기어때', '씨트립', '부킹닷컴', '익스피디아', '네이버', '트립토파즈']
    const channelFilter = channel === 'ota' ? `AND c_name IN (${OTA_CHANNELS.map(c => `'${c}'`).join(',')})` : ''

    const endMonth = (month + 3 - 1) % 12 + 1
    const endYear = month + 3 <= 12 ? year : year + 1

    const result = await duckQuery(`
      SELECT
        CAST(date AS VARCHAR) as pickup_date,
        CAST(checkIn AS VARCHAR) as checkin_date,
        SUM(pk_rv) as revenue
      FROM fact_reservation_event
      WHERE event = '픽업'
        AND isSales = true
        AND EXTRACT(MONTH FROM date) = ${month}
        AND EXTRACT(YEAR FROM date) = ${year}
        AND CAST(checkIn AS DATE) >= DATE '${year}-${String(month).padStart(2,'0')}-01'
        AND CAST(checkIn AS DATE) < DATE '${endYear}-${String(endMonth).padStart(2,'0')}-01'
        ${branchFilter}
        ${channelFilter}
      GROUP BY CAST(date AS VARCHAR), CAST(checkIn AS VARCHAR)
      ORDER BY CAST(date AS VARCHAR), CAST(checkIn AS VARCHAR)
    `)

    // 체크인 주차 계산 (일~토 기준, topline과 동일)
    function getWeekLabel(dateStr: string): string {
      const d = new Date(dateStr)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const firstDay = new Date(y, m - 1, 1)
      const firstDow = firstDay.getDay() // 0=일
      let cursor = new Date(firstDay)
      if (firstDow !== 0) cursor.setDate(cursor.getDate() - firstDow)

      let weekNum = 1
      while (true) {
        const weekEnd = new Date(cursor)
        weekEnd.setDate(weekEnd.getDate() + 6)
        if (d >= cursor && d <= weekEnd) {
          return `${m}월W${weekNum}`
        }
        weekNum++
        cursor = new Date(weekEnd)
        cursor.setDate(cursor.getDate() + 1)
        if (weekNum > 6) return `${m}월W${weekNum}`
      }
    }

    // 집계: pickup_date × checkin_week → revenue
    const matrix: Record<string, Record<string, number>> = {} // pickupDate -> {weekLabel: revenue}
    const allWeeks = new Set<string>()
    const allDates = new Set<string>()

    result.rows.forEach((r: any) => {
      const pd = String(r.pickup_date).substring(0, 10)
      const ci = String(r.checkin_date).substring(0, 10)
      const weekLabel = getWeekLabel(ci)

      allDates.add(pd)
      allWeeks.add(weekLabel)

      if (!matrix[pd]) matrix[pd] = {}
      matrix[pd][weekLabel] = (matrix[pd][weekLabel] || 0) + (r.revenue || 0)
    })

    // 주차 정렬
    const sortedWeeks = [...allWeeks].sort((a, b) => {
      const [am, aw] = a.match(/(\d+)월W(\d+)/)?.slice(1) || ['0', '0']
      const [bm, bw] = b.match(/(\d+)월W(\d+)/)?.slice(1) || ['0', '0']
      return (parseInt(am) * 10 + parseInt(aw)) - (parseInt(bm) * 10 + parseInt(bw))
    })

    // 날짜 정렬
    const sortedDates = [...allDates].sort()

    // 행: 날짜, 열: 주차
    const rows = sortedDates.map(pd => {
      const total = Object.values(matrix[pd] || {}).reduce((s, v) => s + v, 0)
      const cells = sortedWeeks.map(w => matrix[pd]?.[w] || 0)
      return { date: pd, total, cells }
    })

    return NextResponse.json({
      month, year, branch,
      weeks: sortedWeeks,
      rows,
    })
  } catch (error: any) {
    console.error('Pickup Cohort Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
