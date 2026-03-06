import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const requestedDate = searchParams.get('date')
  
  try {
    // 1. "오늘" 정의: raw_bookings 가장 최근 날짜
    const { data: latestBooking } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)
    
    if (!latestBooking || latestBooking.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 })
    }
    
    const today = new Date(latestBooking[0].reservation_created_at)
    
    // 2. 분석 대상: 어제 (사용자가 날짜 지정하면 그 날짜)
    const targetDate = requestedDate 
      ? new Date(requestedDate)
      : new Date(today.setDate(today.getDate() - 1))
    
    const targetDateStr = targetDate.toISOString().split('T')[0]
    
    // 3. 어제 = 분석 대상의 전날
    const yesterday = new Date(targetDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    // 4. 해당 날짜(어제) 데이터 가져오기
    const { data: todayData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', targetDateStr + ' 00:00:00')
      .lte('reservation_created_at', targetDateStr + ' 23:59:59')
    
    // 5. 전날(그저께) 데이터 가져오기
    const { data: yesterdayData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', yesterdayStr + ' 00:00:00')
      .lte('reservation_created_at', yesterdayStr + ' 23:59:59')
    
    // 6. OCC 데이터 가져오기 (분석 대상일부터 7일간)
    const sevenDaysLater = new Date(targetDate)
    sevenDaysLater.setDate(targetDate.getDate() + 7)
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]
    
    const { data: occData } = await supabase
      .from('branch_room_occ')
      .select('*')
      .gte('date', targetDateStr)
      .lte('date', sevenDaysStr)
    
    // 7. 지점별 집계
    const todayByBranch = aggregateByBranch(todayData || [])
    const yesterdayByBranch = aggregateByBranch(yesterdayData || [])
    
    // 8. 이슈 분석
    const urgentActions = analyzeUrgentActions(occData || [], targetDateStr)
    const pricingOpportunities = analyzePricingOpportunities(occData || [], todayByBranch, yesterdayByBranch)
    const anomalies = analyzeAnomalies(todayByBranch, yesterdayByBranch)
    const topPerformers = getTopPerformers(todayByBranch, yesterdayByBranch, 5)
    const bottomPerformers = getBottomPerformers(todayByBranch, yesterdayByBranch, 5)
    
    // 9. DB에 저장
    const { data: existingIssue } = await supabase
      .from('daily_issues')
      .select('id')
      .eq('issue_date', targetDateStr)
      .single()
    
    const issueData = {
      issue_date: targetDateStr,
      urgent_actions: urgentActions,
      pricing_opportunities: pricingOpportunities,
      anomalies: anomalies,
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      total_pickup: Object.values(todayByBranch).reduce((sum: number, b: any) => sum + b.pickup, 0),
      avg_occ: calculateAvgOcc(occData || []),
      data_summary: {
        branches_analyzed: Object.keys(todayByBranch).length,
        compared_to: yesterdayStr,
        generated_at: new Date().toISOString()
      }
    }
    
    if (existingIssue) {
      await supabase
        .from('daily_issues')
        .update(issueData)
        .eq('id', existingIssue.id)
    } else {
      await supabase
        .from('daily_issues')
        .insert([issueData])
    }
    
    return NextResponse.json({
      date: targetDateStr,
      compared_to: yesterdayStr,
      ...issueData
    })
    
  } catch (error: any) {
    console.error('Daily Issues API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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

// 긴급 대응 필요 분석 (기간별 그룹핑)
function analyzeUrgentActions(occData: any[], targetDate: string) {
  const urgent: any[] = []
  const today = new Date(targetDate)
  
  // 주차 계산 함수 (월요일 시작)
  const getWeekLabel = (date: Date) => {
    const month = date.getMonth() + 1
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const firstMonday = new Date(firstDay)
    const dayOfWeek = firstDay.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    firstMonday.setDate(1 + daysToMonday)
    
    const weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    
    return `${month}월 ${weekNumber}주`
  }
  
  // 주말/평일 구분
  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }
  
  // 기간별로 데이터 그룹핑
  const groupedData: Record<string, any[]> = {}
  
  occData.forEach(row => {
    const stayDate = new Date(row.date)
    const daysUntil = Math.floor((stayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    // 30일 이내만
    if (daysUntil < 0 || daysUntil > 30) return
    
    const weekLabel = getWeekLabel(stayDate)
    const dayType = isWeekend(stayDate) ? '주말' : '평일'
    const periodKey = `${weekLabel} ${dayType}`
    
    if (!groupedData[periodKey]) {
      groupedData[periodKey] = []
    }
    
    groupedData[periodKey].push({
      ...row,
      days_until: daysUntil,
      stay_date: row.date
    })
  })
  
  // 각 기간별로 분석
  Object.entries(groupedData).forEach(([period, items]) => {
    const avgOcc = items.reduce((sum, item) => sum + (item.occ || 0), 0) / items.length
    const minDaysUntil = Math.min(...items.map(item => item.days_until))
    const lowOccItems = items.filter(item => item.occ < 0.6)
    const highOccItems = items.filter(item => item.occ >= 0.95)
    
    // 저점유율 경고
    if (lowOccItems.length > 0) {
      const severity = minDaysUntil <= 3 ? 'high' : minDaysUntil <= 7 ? 'medium' : 'low'
      const branches = [...new Set(lowOccItems.map(item => item.branch_name))]
      
      urgent.push({
        period,
        type: 'low_occ',
        severity,
        avg_occ: avgOcc,
        days_until: minDaysUntil,
        affected_branches: branches,
        total_affected: branches.length,
        details: lowOccItems.map(item => ({  // 모든 사례
          branch: item.branch_name,
          room_type: item.room_type,
          date: item.stay_date,
          occ: item.occ,
          adr: item.adr
        })),
        recommendation: minDaysUntil <= 3 
          ? '긴급 프로모션 필요' 
          : minDaysUntil <= 7
          ? '가격 조정 검토'
          : '모니터링 필요'
      })
    }
    
    // 고점유율 기회
    if (highOccItems.length > 0 && minDaysUntil > 7) {
      const branches = [...new Set(highOccItems.map(item => item.branch_name))]
      
      urgent.push({
        period,
        type: 'high_occ',
        severity: 'opportunity',
        avg_occ: avgOcc,
        days_until: minDaysUntil,
        affected_branches: branches,
        total_affected: branches.length,
        details: highOccItems.map(item => ({  // 모든 사례
          branch: item.branch_name,
          room_type: item.room_type,
          date: item.stay_date,
          occ: item.occ,
          adr: item.adr
        })),
        recommendation: '가격 인상 기회'
      })
    }
  })
  
  // 심각도 및 기간 순 정렬
  return urgent.sort((a, b) => {
    if (a.severity === 'high' && b.severity !== 'high') return -1
    if (b.severity === 'high' && a.severity !== 'high') return 1
    return a.days_until - b.days_until
  })
}

// 가격 조정 기회 분석 (기간별)
function analyzePricingOpportunities(occData: any[], todayByBranch: any, yesterdayByBranch: any) {
  const opportunities: any[] = []
  
  const getWeekLabel = (date: Date) => {
    const month = date.getMonth() + 1
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const firstMonday = new Date(firstDay)
    const dayOfWeek = firstDay.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
    firstMonday.setDate(1 + daysToMonday)
    
    const weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    
    return `${month}월 ${weekNumber}주`
  }
  
  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6
  }
  
  // 기간별 그룹핑
  const groupedData: Record<string, any[]> = {}
  
  occData.forEach(row => {
    const occChange = row.occ - (row.occ_1d_ago || 0)
    
    // 예약 속도 빠른 경우 (OCC 1일전 대비 10%p 이상 증가 & 아직 90% 미만)
    if (occChange >= 0.10 && row.occ < 0.9) {
      const stayDate = new Date(row.date)
      const weekLabel = getWeekLabel(stayDate)
      const dayType = isWeekend(stayDate) ? '주말' : '평일'
      const periodKey = `${weekLabel} ${dayType}`
      
      if (!groupedData[periodKey]) {
        groupedData[periodKey] = []
      }
      
      groupedData[periodKey].push({
        ...row,
        occ_change: occChange
      })
    }
  })
  
  // 각 기간별로 요약
  Object.entries(groupedData).forEach(([period, items]) => {
    const branches = [...new Set(items.map(item => item.branch_name))]
    const avgOccChange = items.reduce((sum, item) => sum + item.occ_change, 0) / items.length
    
    opportunities.push({
      period,
      type: 'fast_booking',
      avg_occ_change: avgOccChange,
      affected_branches: branches,
      total_affected: branches.length,
      details: items.map(item => ({  // 모든 사례
        branch: item.branch_name,
        room_type: item.room_type,
        date: item.date,
        occ: item.occ,
        occ_change: item.occ_change,
        adr: item.adr
      })),
      recommendation: '수요 급증 - 가격 인상 검토'
    })
  })
  
  return opportunities
}

// 이상 징후 분석
function analyzeAnomalies(todayByBranch: any, yesterdayByBranch: any) {
  const anomalies: any[] = []
  
  Object.keys(todayByBranch).forEach(branch => {
    const today = todayByBranch[branch]
    const yesterday = yesterdayByBranch[branch]
    
    if (!yesterday) return
    
    const pickupChange = ((today.pickup - yesterday.pickup) / yesterday.pickup) * 100
    
    // 픽업 급락 (30% 이상)
    if (pickupChange <= -30) {
      anomalies.push({
        branch,
        type: 'pickup_drop',
        today_pickup: today.pickup,
        yesterday_pickup: yesterday.pickup,
        change_pct: pickupChange,
        severity: 'high',
        message: `픽업 매출 ${Math.abs(pickupChange).toFixed(0)}% 급락`
      })
    }
    
    // 픽업 급증 (50% 이상)
    if (pickupChange >= 50) {
      anomalies.push({
        branch,
        type: 'pickup_surge',
        today_pickup: today.pickup,
        yesterday_pickup: yesterday.pickup,
        change_pct: pickupChange,
        severity: 'info',
        message: `픽업 매출 ${pickupChange.toFixed(0)}% 급증`
      })
    }
  })
  
  return anomalies
}

// Top 성과 지점
function getTopPerformers(todayByBranch: any, yesterdayByBranch: any, limit: number) {
  const performers: any[] = []
  
  Object.keys(todayByBranch).forEach(branch => {
    const today = todayByBranch[branch]
    const yesterday = yesterdayByBranch[branch]
    
    if (!yesterday || yesterday.pickup === 0) return
    
    const change = ((today.pickup - yesterday.pickup) / yesterday.pickup) * 100
    
    performers.push({
      branch,
      today_pickup: today.pickup,
      yesterday_pickup: yesterday.pickup,
      change_pct: change,
      change_amount: today.pickup - yesterday.pickup
    })
  })
  
  return performers
    .sort((a, b) => b.change_pct - a.change_pct)
    .slice(0, limit)
}

// Bottom 성과 지점
function getBottomPerformers(todayByBranch: any, yesterdayByBranch: any, limit: number) {
  const performers: any[] = []
  
  Object.keys(todayByBranch).forEach(branch => {
    const today = todayByBranch[branch]
    const yesterday = yesterdayByBranch[branch]
    
    if (!yesterday || yesterday.pickup === 0) return
    
    const change = ((today.pickup - yesterday.pickup) / yesterday.pickup) * 100
    
    performers.push({
      branch,
      today_pickup: today.pickup,
      yesterday_pickup: yesterday.pickup,
      change_pct: change,
      change_amount: today.pickup - yesterday.pickup
    })
  })
  
  return performers
    .sort((a, b) => a.change_pct - b.change_pct)
    .slice(0, limit)
}

// 평균 OCC 계산
function calculateAvgOcc(occData: any[]) {
  if (occData.length === 0) return 0
  const sum = occData.reduce((acc, row) => acc + (row.occ || 0), 0)
  return sum / occData.length
}
