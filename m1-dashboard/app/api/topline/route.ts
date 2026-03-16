import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeBranchName } from '@/lib/pricing-engine'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')
  
  try {
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
    const year = 2026

    const { data, error } = await supabase
      .rpc('get_topline_weekly_checkin', {
        p_branch: branch,
        p_month: month,
        p_year: year
      })

    if (error) {
      console.error('Topline RPC Error:', error)
      throw error
    }

    // 월 전체 체크인 매출 (RPC 주차별 합계)
    const totalCI = (data || []).reduce((sum: number, week: any) => sum + (week.ci_amount || 0), 0)

    // 목표 매출 (전지점 제외, branch_name 정규화 매칭)
    const { data: targetData } = await supabase
      .from('targets')
      .select('branch_name, target_amount')
      .eq('month', month)
      .eq('year', year)
      .neq('branch_name', '전지점')

    const totalTarget = (targetData || [])
      .filter(row => {
        if (branch === 'all') return true
        return normalizeBranchName(row.branch_name) === branch
      })
      .reduce((sum, row) => sum + (row.target_amount || 0), 0)

    const achievement = totalTarget > 0 ? (totalCI / totalTarget) * 100 : 0

    // 주차별 OCC 조회
    const weeksWithLabels = await Promise.all((data || []).map(async (week: any) => {
      const startDate = new Date(week.start_date)
      const endDate = new Date(week.end_date)
      const startStr = week.start_date
      const endStr = week.end_date

      let occQuery = supabase
        .from('branch_room_occ')
        .select('date, occ, available_rooms, sold_rooms, revenue')
        .gte('date', startStr)
        .lte('date', endStr)

      if (branch !== 'all') {
        occQuery = occQuery.eq('branch_name', branch)
      }

      const { data: occData } = await occQuery

      // 평일/주말(금,토) 분리 집계
      let wdAvail = 0, wdSold = 0, wdRev = 0
      let weAvail = 0, weSold = 0, weRev = 0
      occData?.forEach((row: any) => {
        const day = new Date(row.date).getDay()
        const isWeekend = day === 5 || day === 6 // 금,토
        const avail = row.available_rooms || 0
        const sold = row.sold_rooms || 0
        const rev = row.revenue || 0
        if (isWeekend) {
          weAvail += avail; weSold += sold; weRev += rev
        } else {
          wdAvail += avail; wdSold += sold; wdRev += rev
        }
      })

      const totalAvailable = wdAvail + weAvail
      const totalSold = wdSold + weSold
      const avgOcc = totalAvailable > 0 ? totalSold / totalAvailable : 0

      return {
        ...week,
        label: `${startDate.getDate()}~${endDate.getDate()}`,
        avg_occ: Math.round(avgOcc * 1000) / 10,
        total_available: totalAvailable,
        total_sold: totalSold,
        weekday_occ: wdAvail > 0 ? Math.round((wdSold / wdAvail) * 1000) / 10 : 0,
        weekend_occ: weAvail > 0 ? Math.round((weSold / weAvail) * 1000) / 10 : 0,
        weekday_adr: wdSold > 0 ? Math.round(wdRev / wdSold) : 0,
        weekend_adr: weSold > 0 ? Math.round(weRev / weSold) : 0,
      }
    }))

    return NextResponse.json({
      branch,
      month,
      year,
      total_ci: totalCI,
      total_target: totalTarget,
      achievement_rate: achievement,
      weeks: weeksWithLabels
    })
  } catch (error: any) {
    console.error('Topline API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
