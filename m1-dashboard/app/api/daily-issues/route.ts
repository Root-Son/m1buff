import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateSmartRecommendations, normalizeBranchName } from '@/lib/pricing-engine'

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

    // 6. OCC 데이터 가져오기 (분석 대상일부터 7일간 = 당일 + 6일)
    const sevenDaysLater = new Date(targetDate)
    sevenDaysLater.setDate(targetDate.getDate() + 6)
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]

    const [occData, yoloPrices, priceGuides] = await Promise.all([
      fetchAllRows('branch_room_occ', targetDateStr, sevenDaysStr),
      fetchAllRows('yolo_prices', targetDateStr, sevenDaysStr),
      fetchAllRows('price_guide', targetDateStr, sevenDaysStr),
    ])

    // 9. 지점별 집계
    const todayByBranch = aggregateByBranch(todayData || [])
    const yesterdayByBranch = aggregateByBranch(yesterdayData || [])

    // 10. 스마트 가격 추천 생성 (7일간, maxLeadDays=6)
    const smartRecommendations = generateSmartRecommendations(
      occData || [],
      yoloPrices || [],
      priceGuides || [],
      targetDateStr,
      6  // 당일 + 6일 = 7일
    )

    // 11. 기존 분석 (이상 징후, 성과 지점)
    const anomalies = analyzeAnomalies(todayByBranch, yesterdayByBranch)
    const topPerformers = getTopPerformers(todayByBranch, yesterdayByBranch, 5)
    const bottomPerformers = getBottomPerformers(todayByBranch, yesterdayByBranch, 5)

    const totalPickup = Object.values(todayByBranch).reduce((sum: number, b: any) => sum + b.pickup, 0)
    const avgOcc = calculateAvgOcc(occData || [])

    // 12. DB에 저장
    const { data: existingIssue } = await supabase
      .from('daily_issues')
      .select('id')
      .eq('issue_date', targetDateStr)
      .single()

    const issueData = {
      issue_date: targetDateStr,
      executive_summary: smartRecommendations.executive_summary,
      smart_recommendations: {
        price_down: smartRecommendations.price_down,
        price_up: smartRecommendations.price_up,
        monitor: smartRecommendations.monitor,
      },
      by_branch: smartRecommendations.by_branch,
      branch_summaries: smartRecommendations.branch_summaries,
      anomalies: anomalies,
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      total_pickup: totalPickup,
      avg_occ: avgOcc,
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
      executive_summary: smartRecommendations.executive_summary,
      smart_recommendations: {
        price_down: smartRecommendations.price_down,
        price_up: smartRecommendations.price_up,
        monitor: smartRecommendations.monitor,
      },
      by_branch: smartRecommendations.by_branch,
      branch_summaries: smartRecommendations.branch_summaries,
      anomalies,
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      total_pickup: totalPickup,
      avg_occ: avgOcc,
      data_summary: {
        branches_analyzed: Object.keys(todayByBranch).length,
        compared_to: yesterdayStr,
        generated_at: new Date().toISOString()
      }
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
    const branch = normalizeBranchName(row.branch_name)
    if (!result[branch]) {
      result[branch] = { pickup: 0, count: 0 }
    }
    result[branch].pickup += row.payment_amount || 0
    result[branch].count += 1
  })

  return result
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

// Supabase 페이지네이션 (1000행 제한 우회)
async function fetchAllRows(table: string, dateFrom: string, dateTo: string): Promise<any[]> {
  const allRows: any[] = []
  const pageSize = 1000
  let page = 0

  while (true) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .range(from, to)

    if (error) break
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < pageSize) break
    page++
  }

  return allRows
}
