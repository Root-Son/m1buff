import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const requestedWeek = searchParams.get('week') // 형식: "2026-03-03" (월요일)
  
  try {
    // 1. "이번 주" 정의: raw_bookings 가장 최근 날짜가 속한 주
    const { data: latestBooking } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)
    
    if (!latestBooking || latestBooking.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 })
    }
    
    const today = new Date(latestBooking[0].reservation_created_at)
    
    // 2. 분석 대상 주 계산
    let targetWeekStart: Date
    
    if (requestedWeek) {
      targetWeekStart = new Date(requestedWeek)
    } else {
      // 가장 최근 완료된 주 (지난주)
      targetWeekStart = getWeekStart(today)
      targetWeekStart.setDate(targetWeekStart.getDate() - 7) // 지난주
    }
    
    const targetWeekEnd = new Date(targetWeekStart)
    targetWeekEnd.setDate(targetWeekStart.getDate() + 6) // 일요일
    
    const weekStartStr = targetWeekStart.toISOString().split('T')[0]
    const weekEndStr = targetWeekEnd.toISOString().split('T')[0]
    
    // 3. 전주 날짜
    const prevWeekStart = new Date(targetWeekStart)
    prevWeekStart.setDate(targetWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(prevWeekStart)
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6)
    
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]
    const prevWeekEndStr = prevWeekEnd.toISOString().split('T')[0]
    
    // 4. 이번주 픽업 데이터
    const { data: thisWeekData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', weekStartStr + ' 00:00:00')
      .lte('reservation_created_at', weekEndStr + ' 23:59:59')
    
    // 5. 전주 픽업 데이터
    const { data: prevWeekData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', prevWeekStartStr + ' 00:00:00')
      .lte('reservation_created_at', prevWeekEndStr + ' 23:59:59')
    
    // 6. OCC 데이터 (다음 4주, 28일)
    const fourWeeksLater = new Date(targetWeekEnd)
    fourWeeksLater.setDate(targetWeekEnd.getDate() + 28)
    const fourWeeksStr = fourWeeksLater.toISOString().split('T')[0]
    
    console.log('OCC Query Range:', { from: weekEndStr, to: fourWeeksStr })
    
    const { data: occData, error: occError } = await supabase
      .from('branch_room_occ')
      .select('*')
      .gte('date', weekEndStr) // 이번주 마지막날부터
      .lte('date', fourWeeksStr)
    
    console.log('OCC Data:', { count: occData?.length, error: occError })
    
    // 7. 월 목표 데이터
    const targetMonth = targetWeekStart.getMonth() + 1
    const targetYear = targetWeekStart.getFullYear()
    
    console.log('Targets Query:', { targetYear, targetMonth })
    
    const { data: monthlyTargets, error: targetsError } = await supabase
      .from('targets')
      .select('*')
      .eq('year', targetYear)
      .eq('month', targetMonth)
    
    console.log('Monthly Targets:', { 
      count: monthlyTargets?.length, 
      error: targetsError,
      sample: monthlyTargets?.[0]
    })
    
    // 8. 해당 월 전체 실적 (체크인 기준)
    const monthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0]
    
    console.log('Monthly Actuals Query:', { monthStart, monthEnd })
    
    const { data: monthlyActuals, error: actualsError } = await supabase
      .from('raw_bookings')
      .select('branch_name, payment_amount')
      .gte('check_in_date', monthStart)
      .lte('check_in_date', monthEnd)
    
    console.log('Monthly Actuals:', { count: monthlyActuals?.length, error: actualsError })
    
    // 9. 지점별 집계
    const thisWeekByBranch = aggregateByBranch(thisWeekData || [])
    const prevWeekByBranch = aggregateByBranch(prevWeekData || [])
    const monthlyActualsByBranch = aggregateByBranch(monthlyActuals || [])
    
    // 10. 분석
    const branchIssues = analyzeBranchIssues(occData || [], weekStartStr, weekEndStr)
    const anomalies = analyzeAnomalies(thisWeekByBranch, prevWeekByBranch)
    const topPerformers = getTopPerformers(thisWeekByBranch, prevWeekByBranch, 5)
    const bottomPerformers = getBottomPerformers(thisWeekByBranch, prevWeekByBranch, 5)
    const topAchievers = getTopAchievers(monthlyActualsByBranch, monthlyTargets || [], 5)
    const bottomAchievers = getBottomAchievers(monthlyActualsByBranch, monthlyTargets || [], 5)
    
    // 11. DB 저장
    const { data: existingReview } = await supabase
      .from('weekly_reviews')
      .select('id')
      .eq('week_start', weekStartStr)
      .eq('week_end', weekEndStr)
      .single()
    
    const reviewData = {
      week_start: weekStartStr,
      week_end: weekEndStr,
      performance_summary: {
        total_pickup: Object.values(thisWeekByBranch).reduce((sum: number, b: any) => sum + b.pickup, 0),
        prev_week_pickup: Object.values(prevWeekByBranch).reduce((sum: number, b: any) => sum + b.pickup, 0),
      },
      top_branches: topPerformers,
      bottom_branches: bottomPerformers,
      trend_analysis: {
        branch_issues: branchIssues,
        anomalies: anomalies,
      },
      next_week_strategy: {
        top_achievers: topAchievers,
        bottom_achievers: bottomAchievers,
      },
      total_pickup: Object.values(thisWeekByBranch).reduce((sum: number, b: any) => sum + b.pickup, 0),
      avg_occ: 0,
      wow_change: calculateWoWChange(thisWeekByBranch, prevWeekByBranch),
    }
    
    if (existingReview) {
      await supabase
        .from('weekly_reviews')
        .update(reviewData)
        .eq('id', existingReview.id)
    } else {
      await supabase
        .from('weekly_reviews')
        .insert([reviewData])
    }
    
    return NextResponse.json(reviewData)
    
  } catch (error: any) {
    console.error('Weekly Reviews API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 주의 시작일 (월요일) 계산
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // 일요일이면 -6, 아니면 월요일까지
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 지점별 집계
function aggregateByBranch(data: any[]) {
  const result: any = {}
  
  data.forEach(row => {
    const branch = row.branch_name
    if (!result[branch]) {
      result[branch] = { pickup: 0, count: 0 }
    }
    result[branch].pickup += row.payment_amount || 0
    result[branch].count += 1
  })
  
  return result
}

// 지점별 주요 이슈 분석 (앞으로 4주)
function analyzeBranchIssues(occData: any[], weekStart: string, weekEnd: string) {
  const issuesByBranch: Record<string, any[]> = {}
  
  // 전체 지점 목록 (여수점 제외)
  const ALL_BRANCHES = [
    '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
    '당진터미널점', '동탄점(호텔)', '명동점', '부산기장점', '부산송도해변점',
    '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
    '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
    '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
    '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
  ]
  
  const endDate = new Date(weekEnd)
  
  // 모든 지점 초기화
  ALL_BRANCHES.forEach(branch => {
    issuesByBranch[branch] = []
  })
  
  // 앞으로 4주를 주차별로 분석
  for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
    const weekStartDate = new Date(endDate)
    weekStartDate.setDate(endDate.getDate() + (weekOffset - 1) * 7 + 1)
    
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekStartDate.getDate() + 6)
    
    const weekLabel = getWeekLabel(weekStartDate)
    
    // 이번 주차의 데이터만 필터링
    const weekData = occData.filter(row => {
      const rowDate = new Date(row.date)
      return rowDate >= weekStartDate && rowDate <= weekEndDate
    })
    
    // 지점별로 그룹핑
    const groupedByBranch: Record<string, any> = {}
    
    weekData.forEach(row => {
      const branch = row.branch_name
      if (!groupedByBranch[branch]) {
        groupedByBranch[branch] = {
          weekend: [],
          weekday: [],
        }
      }
      
      const rowDate = new Date(row.date)
      const day = rowDate.getDay()
      if (day === 0 || day === 6) {
        groupedByBranch[branch].weekend.push(row)
      } else {
        groupedByBranch[branch].weekday.push(row)
      }
    })
    
    // 모든 지점에 대해 분석
    ALL_BRANCHES.forEach(branch => {
      const data = groupedByBranch[branch]
      
      if (!data || (data.weekend.length === 0 && data.weekday.length === 0)) {
        // 데이터 없는 경우
        issuesByBranch[branch].push({
          week: weekLabel,
          issue_type: 'no_data',
          message: `데이터 없음`,
          severity: 'info',
          avg_occ: 0,
        })
        return
      }
      
      const weekendAvgOcc = data.weekend.length > 0
        ? data.weekend.reduce((sum: number, r: any) => sum + r.occ, 0) / data.weekend.length
        : 0
      
      const weekdayAvgOcc = data.weekday.length > 0
        ? data.weekday.reduce((sum: number, r: any) => sum + r.occ, 0) / data.weekday.length
        : 0
      
      // 주말 OCC 저조
      if (weekendAvgOcc > 0 && weekendAvgOcc < 0.6 && data.weekend.length > 0) {
        issuesByBranch[branch].push({
          week: weekLabel,
          issue_type: 'low_weekend_occ',
          message: `주말 OCC 저조 (${(weekendAvgOcc * 100).toFixed(0)}%)`,
          severity: 'high',
          avg_occ: weekendAvgOcc,
        })
      }
      // 평일 OCC 저조
      if (weekdayAvgOcc > 0 && weekdayAvgOcc < 0.5 && data.weekday.length > 0) {
        issuesByBranch[branch].push({
          week: weekLabel,
          issue_type: 'low_weekday_occ',
          message: `평일 OCC 저조 (${(weekdayAvgOcc * 100).toFixed(0)}%)`,
          severity: 'medium',
          avg_occ: weekdayAvgOcc,
        })
      }
      // 가격 상향 기회
      if (weekendAvgOcc >= 0.95 && data.weekend.length > 0) {
        issuesByBranch[branch].push({
          week: weekLabel,
          issue_type: 'price_increase',
          message: `주말 가격 상향 검토 필요 (OCC ${(weekendAvgOcc * 100).toFixed(0)}%)`,
          severity: 'opportunity',
          avg_occ: weekendAvgOcc,
        })
      }
      // 양호한 경우는 추가하지 않음 (중요한 이슈만 표시)
    })
  }
  
  // 배열로 변환 (지점명 포함)
  return Object.entries(issuesByBranch).map(([branch, details]) => ({
    branch,
    details: details.length > 0 ? details : [{ week: '전체', message: '정상', severity: 'normal' }]
  }))
}

// 주차 레이블 생성
function getWeekLabel(date: Date) {
  const month = date.getMonth() + 1
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  let firstMonday = new Date(firstDay)
  
  const dayOfWeek = firstDay.getDay()
  if (dayOfWeek === 0) {
    firstMonday.setDate(2)
  } else if (dayOfWeek !== 1) {
    firstMonday.setDate(1 + (8 - dayOfWeek))
  }
  
  if (date < firstMonday) {
    const prevMonth = date.getMonth()
    const prevMonthFirstDay = new Date(date.getFullYear(), prevMonth, 1)
    let prevFirstMonday = new Date(prevMonthFirstDay)
    const prevDayOfWeek = prevMonthFirstDay.getDay()
    if (prevDayOfWeek === 0) {
      prevFirstMonday.setDate(2)
    } else if (prevDayOfWeek !== 1) {
      prevFirstMonday.setDate(1 + (8 - prevDayOfWeek))
    }
    
    const weekNumber = Math.floor((date.getTime() - prevFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    return `${prevMonth}월 ${weekNumber}주`
  }
  
  const weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  
  return `${month}월 ${weekNumber}주`
}

// 이상 징후 분석
function analyzeAnomalies(thisWeek: any, prevWeek: any) {
  const anomalies: any[] = []
  
  Object.keys(thisWeek).forEach(branch => {
    const thisPickup = thisWeek[branch].pickup
    const prevPickup = prevWeek[branch]?.pickup || 0
    
    if (prevPickup === 0) return
    
    const change = ((thisPickup - prevPickup) / prevPickup) * 100
    
    if (change <= -30) {
      anomalies.push({
        branch,
        type: 'pickup_drop',
        this_week_pickup: thisPickup,
        prev_week_pickup: prevPickup,
        change_pct: change,
        severity: 'high',
        message: `전주 대비 픽업 ${Math.abs(change).toFixed(0)}% 급락`,
      })
    }
    
    if (change >= 50) {
      anomalies.push({
        branch,
        type: 'pickup_surge',
        this_week_pickup: thisPickup,
        prev_week_pickup: prevPickup,
        change_pct: change,
        severity: 'info',
        message: `전주 대비 픽업 ${change.toFixed(0)}% 급증`,
      })
    }
  })
  
  return anomalies
}

// Top 성과
function getTopPerformers(thisWeek: any, prevWeek: any, limit: number) {
  const performers: any[] = []
  
  Object.keys(thisWeek).forEach(branch => {
    const thisPickup = thisWeek[branch].pickup
    const prevPickup = prevWeek[branch]?.pickup || 0
    
    if (prevPickup === 0) return
    
    const change = ((thisPickup - prevPickup) / prevPickup) * 100
    
    performers.push({
      branch,
      this_week_pickup: thisPickup,
      prev_week_pickup: prevPickup,
      change_pct: change,
      change_amount: thisPickup - prevPickup,
    })
  })
  
  return performers.sort((a, b) => b.change_pct - a.change_pct).slice(0, limit)
}

// Bottom 성과
function getBottomPerformers(thisWeek: any, prevWeek: any, limit: number) {
  const performers: any[] = []
  
  Object.keys(thisWeek).forEach(branch => {
    const thisPickup = thisWeek[branch].pickup
    const prevPickup = prevWeek[branch]?.pickup || 0
    
    if (prevPickup === 0) return
    
    const change = ((thisPickup - prevPickup) / prevPickup) * 100
    
    performers.push({
      branch,
      this_week_pickup: thisPickup,
      prev_week_pickup: prevPickup,
      change_pct: change,
      change_amount: thisPickup - prevPickup,
    })
  })
  
  return performers.sort((a, b) => a.change_pct - b.change_pct).slice(0, limit)
}

// 목표 달성률 Top
function getTopAchievers(actualsByBranch: any, targets: any[], limit: number) {
  const achievers: any[] = []
  
  console.log('Top Achievers - Actuals branches:', Object.keys(actualsByBranch).length)
  console.log('Top Achievers - Targets count:', targets.length)
  
  Object.keys(actualsByBranch).forEach(branch => {
    const actual = actualsByBranch[branch].pickup
    const target = targets.find((t: any) => t.branch_name === branch)
    
    console.log(`Branch: ${branch}, Actual: ${actual}, Target:`, target?.target_amount)
    
    if (!target || !target.target_amount) return
    
    const achievement = (actual / target.target_amount) * 100
    
    achievers.push({
      branch,
      actual,
      target: target.target_amount,
      achievement_pct: achievement,
    })
  })
  
  console.log('Top Achievers result:', achievers.length)
  
  return achievers.sort((a, b) => b.achievement_pct - a.achievement_pct).slice(0, limit)
}

// 목표 달성률 Bottom
function getBottomAchievers(actualsByBranch: any, targets: any[], limit: number) {
  const achievers: any[] = []
  
  Object.keys(actualsByBranch).forEach(branch => {
    const actual = actualsByBranch[branch].pickup
    const target = targets.find((t: any) => t.branch_name === branch)
    
    if (!target || !target.target_amount) return
    
    const achievement = (actual / target.target_amount) * 100
    
    achievers.push({
      branch,
      actual,
      target: target.target_amount,
      achievement_pct: achievement,
    })
  })
  
  return achievers.sort((a, b) => a.achievement_pct - b.achievement_pct).slice(0, limit)
}

// WoW 변화율
function calculateWoWChange(thisWeek: any, prevWeek: any) {
  const thisTotal = Object.values(thisWeek).reduce((sum: number, b: any) => sum + b.pickup, 0)
  const prevTotal = Object.values(prevWeek).reduce((sum: number, b: any) => sum + b.pickup, 0)
  
  if (prevTotal === 0) return 0
  
  return ((thisTotal - prevTotal) / prevTotal) * 100
}
