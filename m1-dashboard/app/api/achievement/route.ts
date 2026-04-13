import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// raw_bookings 기준 (topline과 동일 소스)

async function fetchAllPages(queryFn: (range: [number, number]) => any): Promise<any[]> {
  const PAGE = 1000
  let all: any[] = []
  let page = 0
  while (true) {
    const { data } = await queryFn([page * PAGE, (page + 1) * PAGE - 1])
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    page++
  }
  return all
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')
  const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
  const year = 2026

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  try {
    // 1. targets
    const { data: targets } = await supabase
      .from('targets')
      .select('branch_name, target_amount')
      .eq('month', month)
      .eq('year', year)

    const EXCLUDE = ['동탄점(호텔)', '웨이브파크_펜트']
    const targetMap: Record<string, number> = {}
    ;(targets || []).forEach((t: any) => {
      if (!EXCLUDE.includes(t.branch_name)) {
        targetMap[t.branch_name] = t.target_amount || 0
      }
    })

    // 2. raw_bookings 체크인 매출
    const allBookings = await fetchAllPages(([s, e]) => {
      let q = supabase
        .from('raw_bookings')
        .select('branch_name, check_in_date, payment_amount')
        .gte('check_in_date', monthStart)
        .lte('check_in_date', monthEnd)
      if (branch !== 'all') q = q.eq('branch_name', branch)
      return q.range(s, e)
    })

    if (branch === 'all') {
      // 전지점: 지점별 달성 현황
      const branchRev: Record<string, number> = {}
      allBookings.forEach((r: any) => {
        branchRev[r.branch_name] = (branchRev[r.branch_name] || 0) + (r.payment_amount || 0)
      })

      const branches = Object.keys(targetMap).sort()
      const rows = branches.map(b => {
        const revenue = branchRev[b] || 0
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
        type: 'all',
        month,
        year,
        total: { revenue: totalRev, target: totalTarget, rate: totalTarget > 0 ? Math.round(totalRev / totalTarget * 1000) / 10 : 0 },
        branches: rows,
      })
    } else {
      // 개별 지점: 날짜별 누적 달성률
      const target = targetMap[branch] || 0

      const dailyRev: Record<string, number> = {}
      allBookings.forEach((r: any) => {
        const d = String(r.check_in_date).substring(0, 10)
        dailyRev[d] = (dailyRev[d] || 0) + (r.payment_amount || 0)
      })

      const sortedDates = Object.keys(dailyRev).sort()
      let cumulative = 0
      const days = sortedDates.map(d => {
        cumulative += dailyRev[d] || 0
        return {
          date: d,
          daily: dailyRev[d] || 0,
          cumulative,
          rate: target > 0 ? Math.round(cumulative / target * 1000) / 10 : 0,
        }
      })

      return NextResponse.json({
        type: 'branch',
        branch,
        month,
        year,
        target,
        days,
      })
    }
  } catch (error: any) {
    console.error('Achievement API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
