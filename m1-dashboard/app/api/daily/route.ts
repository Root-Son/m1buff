import { NextRequest, NextResponse } from 'next/server'
import { duckQuery } from '@/lib/duck'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const dateParam = searchParams.get('date')

  try {
    const dateStr = dateParam || new Date().toISOString().split('T')[0]
    const d = new Date(dateStr)
    d.setDate(d.getDate() - 7)
    const lastWeekStr = d.toISOString().split('T')[0]

    const escapedBranch = branch.replace(/'/g, "''")
    const branchFilter = branch !== 'all' ? `AND b_name = '${escapedBranch}'` : ''

    const curDate = new Date(dateStr)
    const m1 = curDate.getMonth() + 1
    const m2 = m1 < 12 ? m1 + 1 : 1
    const m3 = m2 < 12 ? m2 + 1 : 1
    const year = curDate.getFullYear()
    const y2 = m2 < m1 ? year + 1 : year
    const y3 = m3 < m2 ? year + 1 : year

    // 픽업 이벤트: date = 픽업일, checkIn = 체크인일
    // "오늘 픽업된 예약 중 N월 체크인인 것의 매출"
    const buildQuery = (pickupDate: string) => `
      SELECT
        COALESCE(SUM(pk_rv), 0) as pickup,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM checkIn) = ${m1} AND EXTRACT(YEAR FROM checkIn) = ${year} THEN pk_rv END), 0) as month1_ci,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM checkIn) = ${m2} AND EXTRACT(YEAR FROM checkIn) = ${y2} THEN pk_rv END), 0) as month2_ci,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM checkIn) = ${m3} AND EXTRACT(YEAR FROM checkIn) = ${y3} THEN pk_rv END), 0) as month3_ci
      FROM fact_reservation_event
      WHERE event = '픽업'
        AND isSales = true
       
        AND CAST(date AS VARCHAR) = '${pickupDate}'
        ${branchFilter}
    `

    const [todayResult, lastWeekResult] = await Promise.all([
      duckQuery(buildQuery(dateStr)),
      duckQuery(buildQuery(lastWeekStr)),
    ])

    const today = todayResult.rows[0] || {}
    const lastWeek = lastWeekResult.rows[0] || {}

    const wow = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : 0

    return NextResponse.json({
      date: dateStr,
      compare_date: lastWeekStr,
      branch,
      pickup: today.pickup || 0,
      pickup_wow: wow(today.pickup || 0, lastWeek.pickup || 0),
      month1: m1,
      month1_ci: today.month1_ci || 0,
      month1_ci_wow: wow(today.month1_ci || 0, lastWeek.month1_ci || 0),
      month2: m2,
      month2_ci: today.month2_ci || 0,
      month2_ci_wow: wow(today.month2_ci || 0, lastWeek.month2_ci || 0),
      month3: m3,
      month3_ci: today.month3_ci || 0,
      month3_ci_wow: wow(today.month3_ci || 0, lastWeek.month3_ci || 0),
    })
  } catch (error: any) {
    console.error('Daily API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
