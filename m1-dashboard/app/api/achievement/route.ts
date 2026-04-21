import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { duckQuery } from '@/lib/duck'

// duck 기준 체크인 매출 (raw_bookings 제거)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
  const year = 2026

  const EXCLUDE = ['동탄점(호텔)', '웨이브파크_펜트']

  try {
    // 1. targets (Supabase 유지)
    const { data: targets } = await supabase
      .from('targets')
      .select('branch_name, target_amount')
      .eq('month', month)
      .eq('year', year)

    const targetMap: Record<string, number> = {}
    ;(targets || []).forEach((t: any) => {
      if (!EXCLUDE.includes(t.branch_name)) {
        targetMap[t.branch_name] = t.target_amount || 0
      }
    })

    if (branch === 'all') {
      // 전지점: 지점별 달성 현황
      const result = await duckQuery(`
        SELECT
          b_name,
          SUM(ci_rv) as revenue
        FROM fact_reservation_event
        WHERE event = '체크인'
          AND isSales = true
          AND EXTRACT(MONTH FROM date) = ${month}
          AND EXTRACT(YEAR FROM date) = ${year}
        GROUP BY b_name
      `)

      const branches = Object.keys(targetMap).sort()
      const rows = branches.map(b => {
        const duck = result.rows.find((r: any) => r.b_name === b)
        const revenue = duck?.revenue || 0
        const target = targetMap[b] || 0
        return {
          branch: b,
          revenue,
          target,
          rate: target > 0 ? Math.round(revenue / target * 1000) / 10 : 0,
        }
      })

      const totalRev = rows.reduce((s, r) => s + r.revenue, 0)
      const totalTarget = rows.reduce((s, r) => s + r.target, 0)

      return NextResponse.json({
        type: 'all', month, year,
        total: { revenue: totalRev, target: totalTarget, rate: totalTarget > 0 ? Math.round(totalRev / totalTarget * 1000) / 10 : 0 },
        branches: rows,
      })
    } else {
      // 개별 지점: 날짜별 누적 달성률
      const target = targetMap[branch] || 0
      const escapedBranch = branch.replace(/'/g, "''")

      const result = await duckQuery(`
        SELECT
          CAST(date AS VARCHAR) as date,
          SUM(ci_rv) as daily_revenue
        FROM fact_reservation_event
        WHERE event = '체크인'
          AND isSales = true
          AND b_name = '${escapedBranch}'
          AND EXTRACT(MONTH FROM date) = ${month}
          AND EXTRACT(YEAR FROM date) = ${year}
        GROUP BY CAST(date AS VARCHAR)
        ORDER BY CAST(date AS VARCHAR)
      `)

      let cumulative = 0
      const days = result.rows.map((r: any) => {
        cumulative += r.daily_revenue || 0
        return {
          date: String(r.date).substring(0, 10),
          daily: r.daily_revenue || 0,
          cumulative,
          rate: target > 0 ? Math.round(cumulative / target * 1000) / 10 : 0,
        }
      })

      return NextResponse.json({ type: 'branch', branch, month, year, target, days })
    }
  } catch (error: any) {
    console.error('Achievement API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
