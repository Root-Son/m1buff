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

    // 월 전체 체크인 매출
    let ciQuery = supabase
      .from('raw_bookings')
      .select('payment_amount')
      .gte('check_in_date', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('check_in_date', month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${(month + 1).toString().padStart(2, '0')}-01`)

    if (branch !== 'all') {
      ciQuery = ciQuery.eq('branch_name', branch)
    }

    const { data: ciData } = await ciQuery
    const totalCI = ciData?.reduce((sum, row) => sum + (row.payment_amount || 0), 0) || 0

    // 목표 매출
    let targetQuery = supabase
      .from('targets')
      .select('target_amount')
      .eq('month', month)
      .eq('year', year)

    if (branch !== 'all') {
      targetQuery = targetQuery.eq('branch_name', branch)
    }

    const { data: targetData } = await targetQuery
    const totalTarget = targetData?.reduce((sum, row) => sum + (row.target_amount || 0), 0) || 0

    const achievement = totalTarget > 0 ? (totalCI / totalTarget) * 100 : 0

    // 주간 라벨 추가
    const weeksWithLabels = (data || []).map((week: any) => {
      // week_num으로 날짜 범위 계산
      const weekNum = week.week_num
      const firstDay = new Date(year, month - 1, 1)
      const startDate = new Date(firstDay)
      startDate.setDate(1 + (weekNum - 1) * 7)
      
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      
      // 월 마지막 날 제한
      const lastDayOfMonth = new Date(year, month, 0).getDate()
      if (endDate.getDate() > lastDayOfMonth && endDate.getMonth() > startDate.getMonth()) {
        endDate.setDate(lastDayOfMonth)
        endDate.setMonth(month - 1)
      }
      
      return {
        ...week,
        label: `${startDate.getDate()}~${endDate.getDate()}`
      }
    })

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
