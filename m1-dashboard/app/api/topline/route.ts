import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    // 목표 매출 (전지점 제외)
    let targetQuery = supabase
      .from('targets')
      .select('target_amount')
      .eq('month', month)
      .eq('year', year)
      .neq('branch_name', '전지점')

    if (branch !== 'all') {
      targetQuery = targetQuery.eq('branch_name', branch)
    }

    const { data: targetData } = await targetQuery
    const totalTarget = targetData?.reduce((sum, row) => sum + (row.target_amount || 0), 0) || 0

    const achievement = totalTarget > 0 ? (totalCI / totalTarget) * 100 : 0

    // 주차별 OCC 조회
    const weeksWithLabels = await Promise.all((data || []).map(async (week: any) => {
      const startDate = new Date(week.start_date)
      const endDate = new Date(week.end_date)
      const startStr = week.start_date
      const endStr = week.end_date

      let occQuery = supabase
        .from('branch_room_occ')
        .select('occ, available_rooms, sold_rooms')
        .gte('date', startStr)
        .lte('date', endStr)

      if (branch !== 'all') {
        occQuery = occQuery.eq('branch_name', branch)
      }

      const { data: occData } = await occQuery

      // 총 available / 총 sold 로 가중평균 OCC 계산
      let totalAvailable = 0
      let totalSold = 0
      occData?.forEach((row: any) => {
        totalAvailable += row.available_rooms || 0
        totalSold += row.sold_rooms || 0
      })
      const avgOcc = totalAvailable > 0 ? totalSold / totalAvailable : 0

      return {
        ...week,
        label: `${startDate.getDate()}~${endDate.getDate()}`,
        avg_occ: Math.round(avgOcc * 1000) / 10, // 소수점 1자리 %
        total_available: totalAvailable,
        total_sold: totalSold,
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
