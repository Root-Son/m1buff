// Version: V3-FIXED-PAGINATION
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { PricingRecommendation } from '@/lib/supabase'
import {
  generateSmartRecommendations,
  normalizeBranchName,
  ROOM_COUNTS,
  getTotalRooms,
  calculatePricingRecommendation,
  determineSalesPace,
  generateExecutiveSummary,
  generateBranchSummary,
} from '@/lib/pricing-engine'

// ===== Supabase 페이지네이션 헬퍼 (1000행 제한 우회) =====
async function fetchAllRows(table: string, select: string, filters: { gte?: [string, string]; lte?: [string, string] }): Promise<any[]> {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)

    if (filters.gte) query = query.gte(filters.gte[0], filters.gte[1])
    if (filters.lte) query = query.lte(filters.lte[0], filters.lte[1])

    const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      console.error(`${table} query error (page ${page}):`, error)
      break
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
      hasMore = data.length === PAGE_SIZE
      page++
    } else {
      hasMore = false
    }
  }

  return allData
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const requestedWeek = searchParams.get('week')

  try {
    const { data: latestBooking } = await supabase
      .from('raw_bookings')
      .select('reservation_created_at')
      .order('reservation_created_at', { ascending: false })
      .limit(1)

    if (!latestBooking || latestBooking.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 })
    }

    const today = new Date(latestBooking[0].reservation_created_at)

    let targetWeekStart: Date

    if (requestedWeek) {
      targetWeekStart = new Date(requestedWeek)
    } else {
      targetWeekStart = getWeekStart(today)
      targetWeekStart.setDate(targetWeekStart.getDate() - 7)
    }

    const targetWeekEnd = new Date(targetWeekStart)
    targetWeekEnd.setDate(targetWeekStart.getDate() + 6)

    const weekStartStr = targetWeekStart.toISOString().split('T')[0]
    const weekEndStr = targetWeekEnd.toISOString().split('T')[0]

    // Dynamic OCC date range: targetWeekEnd + 1 day to targetWeekEnd + 28 days
    const occStartDate = new Date(targetWeekEnd)
    occStartDate.setDate(occStartDate.getDate() + 1)
    const occEndDate = new Date(targetWeekEnd)
    occEndDate.setDate(occEndDate.getDate() + 28)

    const occStartStr = occStartDate.toISOString().split('T')[0]
    const occEndStr = occEndDate.toISOString().split('T')[0]

    // Previous week
    const prevWeekStart = new Date(targetWeekStart)
    prevWeekStart.setDate(targetWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(prevWeekStart)
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6)

    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]
    const prevWeekEndStr = prevWeekEnd.toISOString().split('T')[0]

    // Pickup data
    const { data: thisWeekData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', weekStartStr + ' 00:00:00')
      .lte('reservation_created_at', weekEndStr + ' 23:59:59')

    const { data: prevWeekData } = await supabase
      .from('raw_bookings')
      .select('*')
      .gte('reservation_created_at', prevWeekStartStr + ' 00:00:00')
      .lte('reservation_created_at', prevWeekEndStr + ' 23:59:59')

    // ★ OCC data - 페이지네이션으로 전체 가져오기 (1000행 제한 해결)
    const occData = await fetchAllRows('branch_room_occ', '*', {
      gte: ['date', occStartStr],
      lte: ['date', occEndStr],
    })

    // Yolo prices (페이지네이션)
    const yoloPrices = await fetchAllRows('yolo_prices', 'date, branch_name, room_type, price', {
      gte: ['date', occStartStr],
      lte: ['date', occEndStr],
    })

    // Price guides (페이지네이션)
    const priceGuides = await fetchAllRows('price_guide', 'date, branch_name, room_type, min_price', {
      gte: ['date', occStartStr],
      lte: ['date', occEndStr],
    })

    // Monthly targets
    const targetMonth = targetWeekStart.getMonth() + 1
    const targetYear = targetWeekStart.getFullYear()

    const { data: monthlyTargets } = await supabase
      .from('targets')
      .select('*')
      .eq('year', targetYear)
      .eq('month', targetMonth)

    // Monthly actuals: topline RPC와 동일한 방식 사용 (체크인 매출 기준)
    const { data: monthlyTargets2 } = await supabase
      .from('targets')
      .select('branch_name, target_amount')
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .neq('branch_name', '전지점')

    const monthlyActualsByBranch: Record<string, { pickup: number }> = {}
    // 각 지점별 RPC 호출하여 체크인 매출 집계
    const targetBranches = (monthlyTargets2 || []).map(t => t.branch_name).filter(Boolean)
    for (const branchName of targetBranches) {
      try {
        const { data: rpcData } = await supabase.rpc('get_topline_weekly_checkin', {
          p_branch: branchName,
          p_month: targetMonth,
          p_year: targetYear
        })
        const totalCI = (rpcData || []).reduce((sum: number, w: any) => sum + (w.ci_amount || 0), 0)
        const normalized = normalizeBranchName(branchName)
        monthlyActualsByBranch[normalized] = { pickup: totalCI }
      } catch (err) {
        console.error(`RPC 실패 (${branchName}):`, err)
      }
    }

    // Aggregate by branch
    const thisWeekByBranch = aggregateByBranch(thisWeekData || [])
    const prevWeekByBranch = aggregateByBranch(prevWeekData || [])

    // Analysis
    const branchIssues = analyzeBranchIssues(
      occData || [],
      yoloPrices || [],
      priceGuides || [],
      weekEndStr
    )

    const anomalies = analyzeAnomalies(thisWeekByBranch, prevWeekByBranch)
    const topPerformers = getTopPerformers(thisWeekByBranch, prevWeekByBranch, 5)
    const bottomPerformers = getBottomPerformers(thisWeekByBranch, prevWeekByBranch, 5)
    const topAchievers = getTopAchievers(monthlyActualsByBranch, monthlyTargets || [], 5)
    const bottomAchievers = getBottomAchievers(monthlyActualsByBranch, monthlyTargets || [], 5)

    // Generate weekly executive summary from all branch issues
    const allRecommendations: PricingRecommendation[] = []
    branchIssues.forEach(bi => {
      bi.details.forEach((d: any) => {
        if (d.recommendations) {
          allRecommendations.push(...d.recommendations)
        }
      })
    })

    const weeklyExecutiveSummary = {
      total_price_down: allRecommendations.filter(r => r.action === 'price_down').length,
      total_price_up: allRecommendations.filter(r => r.action === 'price_up').length,
      total_monitor: allRecommendations.filter(r => r.action === 'monitor').length,
      total_critical: allRecommendations.filter(r => r.urgency === 'critical').length,
      top_action_branches: [...new Set(
        allRecommendations
          .filter(r => r.action === 'price_down' && (r.urgency === 'critical' || r.urgency === 'high'))
          .map(r => r.branch_name)
      )].slice(0, 5),
    }

    // DB save
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
        weekly_executive_summary: weeklyExecutiveSummary,
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

    return NextResponse.json({
      ...reviewData,
      weekly_executive_summary: weeklyExecutiveSummary,
    })

  } catch (error: any) {
    console.error('Weekly Reviews V2 ERROR:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

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

function analyzeBranchIssues(
  occData: any[],
  yoloPrices: any[],
  priceGuides: any[],
  weekEnd: string
) {
  const ALL_BRANCHES = Object.keys(ROOM_COUNTS)

  const endDate = new Date(weekEnd)

  // Build yolo price and price guide maps
  const yoloPriceMap = new Map<string, number>()
  yoloPrices.forEach(yp => {
    const key = `${yp.date}|${normalizeBranchName(yp.branch_name)}|${yp.room_type}`
    yoloPriceMap.set(key, yp.price)
  })

  const priceGuideMap = new Map<string, number>()
  priceGuides.forEach(pg => {
    const key = `${pg.date}|${normalizeBranchName(pg.branch_name)}|${pg.room_type}`
    priceGuideMap.set(key, pg.min_price)
  })

  const issuesByBranch: Record<string, any[]> = {}
  ALL_BRANCHES.forEach(branch => {
    issuesByBranch[branch] = []
  })

  // Use weekEnd as the "today" reference for lead time calculation
  const referenceDate = new Date(endDate)
  referenceDate.setDate(referenceDate.getDate() + 1)

  // Forward 4 weeks
  for (let weekOffset = 1; weekOffset <= 4; weekOffset++) {
    const weekStartDate = new Date(endDate.getTime())
    weekStartDate.setDate(weekStartDate.getDate() + (weekOffset - 1) * 7 + 1)

    const weekEndDate = new Date(weekStartDate.getTime())
    weekEndDate.setDate(weekEndDate.getDate() + 6)

    const weekStartStr = weekStartDate.toISOString().split('T')[0]
    const weekEndStr2 = weekEndDate.toISOString().split('T')[0]
    const weekLabel = getWeekLabel(weekStartDate)

    // Filter OCC data for this week
    const weekOccData = occData.filter(row => {
      return row.date >= weekStartStr && row.date <= weekEndStr2
    })

    // Group OCC data by branch
    const occByBranch: Record<string, any[]> = {}
    weekOccData.forEach(row => {
      const branch = normalizeBranchName(row.branch_name)
      if (!occByBranch[branch]) {
        occByBranch[branch] = []
      }
      occByBranch[branch].push(row)
    })

    ALL_BRANCHES.forEach(branch => {
      const branchOccRows = occByBranch[branch] || []

      // 평일/주말 OCC & ADR 집계
      let wdAvail = 0, wdSold = 0, wdRev = 0
      let weAvail = 0, weSold = 0, weRev = 0
      branchOccRows.forEach((row: any) => {
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
      const occAdr = {
        weekday_occ: wdAvail > 0 ? Math.round((wdSold / wdAvail) * 1000) / 10 : 0,
        weekend_occ: weAvail > 0 ? Math.round((weSold / weAvail) * 1000) / 10 : 0,
        weekday_adr: wdSold > 0 ? Math.round(wdRev / wdSold) : 0,
        weekend_adr: weSold > 0 ? Math.round(weRev / weSold) : 0,
      }

      if (branchOccRows.length === 0) {
        issuesByBranch[branch].push({
          week: weekLabel,
          recommendations: [],
          occ_adr: occAdr,
          summary: {
            price_down_count: 0,
            price_up_count: 0,
            monitor_count: 0,
            total_remaining_rooms: 0,
            most_urgent_message: '데이터 없음',
          },
          severity: 'info' as const,
        })
        return
      }

      // Generate recommendations for each OCC row in this branch+week
      const recommendations: PricingRecommendation[] = []

      branchOccRows.forEach(row => {
        const stayDate = new Date(row.date)
        const leadTimeDays = Math.floor(
          (stayDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (leadTimeDays < 0) return

        const lookupKey = `${row.date}|${branch}|${row.room_type}`
        const setPrice = yoloPriceMap.get(lookupKey) || null
        const guardrailPrice = priceGuideMap.get(lookupKey) || null
        const totalRooms = getTotalRooms(branch, row.room_type)

        const rec = calculatePricingRecommendation({
          branch_name: branch,
          room_type: row.room_type,
          date: row.date,
          available_rooms: row.available_rooms || 0,
          total_rooms: totalRooms,
          lead_time_days: leadTimeDays,
          set_price: setPrice,
          guardrail_price: guardrailPrice,
          occ: row.occ || 0,
          occ_1d_ago: row.occ_1d_ago || 0,
          occ_7d_ago: row.occ_7d_ago || 0,
          delta_1d_pp: (row.delta_1d_pp || 0) * 100,
          delta_7d_pp: (row.delta_7d_pp || 0) * 100,
        })

        recommendations.push(rec)
      })

      // Summarize
      const priceDownItems = recommendations.filter(r => r.action === 'price_down')
      const priceUpItems = recommendations.filter(r => r.action === 'price_up')
      const monitorItems = recommendations.filter(r => r.action === 'monitor')
      // ★ remaining_rooms 사용 (미판매 잔여)
      const totalRemainingRooms = recommendations.reduce((sum, r) => sum + r.remaining_rooms, 0)

      // Find most urgent recommendation
      const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      const sortedByUrgency = [...recommendations].sort((a, b) => {
        const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
        if (urgDiff !== 0) return urgDiff
        return a.lead_time_days - b.lead_time_days
      })

      const mostUrgent = sortedByUrgency[0]
      const mostUrgentMessage = mostUrgent
        ? `${mostUrgent.room_type} (${mostUrgent.date}): ${mostUrgent.message}`
        : '정상'

      // Determine severity for the week
      let severity: 'high' | 'medium' | 'opportunity' | 'normal' | 'info' = 'normal'
      if (recommendations.some(r => r.urgency === 'critical')) {
        severity = 'high'
      } else if (recommendations.some(r => r.urgency === 'high')) {
        severity = 'high'
      } else if (priceDownItems.length > 0) {
        severity = 'medium'
      } else if (priceUpItems.length > 0) {
        severity = 'opportunity'
      }

      issuesByBranch[branch].push({
        week: weekLabel,
        recommendations,
        occ_adr: occAdr,
        summary: {
          price_down_count: priceDownItems.length,
          price_up_count: priceUpItems.length,
          monitor_count: monitorItems.length,
          total_remaining_rooms: totalRemainingRooms,
          most_urgent_message: mostUrgentMessage,
        },
        severity,
      })
    })
  }

  // 지점별 한줄요약 추가, 가나다순 정렬
  const result = Object.entries(issuesByBranch)
    .map(([branch, details]) => {
      const allRecs = details.flatMap((d: any) => d.recommendations || [])
      return {
        branch,
        branch_summary: generateBranchSummary(allRecs),
        details: details.length > 0 ? details : [{
          week: '전체',
          recommendations: [],
          summary: {
            price_down_count: 0,
            price_up_count: 0,
            monitor_count: 0,
            total_remaining_rooms: 0,
            most_urgent_message: '정상',
          },
          severity: 'normal',
        }],
      }
    })
    .sort((a, b) => a.branch.localeCompare(b.branch, 'ko'))

  return result
}

function getWeekLabel(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()

  const firstDay = new Date(year, month, 1)
  let firstMonday = new Date(firstDay)

  const dayOfWeek = firstDay.getDay()
  if (dayOfWeek === 0) {
    firstMonday.setDate(2)
  } else if (dayOfWeek !== 1) {
    firstMonday.setDate(1 + (8 - dayOfWeek))
  }

  if (date < firstMonday) {
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const prevMonthFirstDay = new Date(prevYear, prevMonth, 1)
    let prevFirstMonday = new Date(prevMonthFirstDay)
    const prevDayOfWeek = prevMonthFirstDay.getDay()
    if (prevDayOfWeek === 0) {
      prevFirstMonday.setDate(2)
    } else if (prevDayOfWeek !== 1) {
      prevFirstMonday.setDate(1 + (8 - prevDayOfWeek))
    }

    const weekNumber = Math.floor((date.getTime() - prevFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    return `${prevMonth + 1}월 ${weekNumber}주`
  }

  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  const nextMonthFirstDay = new Date(nextYear, nextMonth, 1)
  let nextFirstMonday = new Date(nextMonthFirstDay)
  const nextDayOfWeek = nextMonthFirstDay.getDay()
  if (nextDayOfWeek === 0) {
    nextFirstMonday.setDate(2)
  } else if (nextDayOfWeek !== 1) {
    nextFirstMonday.setDate(1 + (8 - nextDayOfWeek))
  }

  if (date >= nextFirstMonday) {
    const weekNumber = Math.floor((date.getTime() - nextFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    return `${nextMonth + 1}월 ${weekNumber}주`
  }

  let weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  // ★ 5주차 이상이면 다음달 1주차로 표시
  if (weekNumber >= 5) {
    const nMonth = month === 11 ? 0 : month + 1
    const adjustedWeekNum = weekNumber - 4
    return `${nMonth + 1}월 ${adjustedWeekNum}주`
  }

  return `${month + 1}월 ${weekNumber}주`
}

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

function getTopAchievers(actualsByBranch: any, targets: any[], limit: number) {
  const achievers: any[] = []

  Object.keys(actualsByBranch).forEach(branch => {
    const actual = actualsByBranch[branch].pickup
    const target = targets.find((t: any) => normalizeBranchName(t.branch_name) === branch)

    if (!target || !target.target_amount) return

    const achievement = (actual / target.target_amount) * 100

    achievers.push({
      branch,
      actual,
      target: target.target_amount,
      achievement_pct: achievement,
    })
  })

  return achievers.sort((a, b) => b.achievement_pct - a.achievement_pct).slice(0, limit)
}

function getBottomAchievers(actualsByBranch: any, targets: any[], limit: number) {
  const achievers: any[] = []

  Object.keys(actualsByBranch).forEach(branch => {
    const actual = actualsByBranch[branch].pickup
    const target = targets.find((t: any) => normalizeBranchName(t.branch_name) === branch)

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

function calculateWoWChange(thisWeek: any, prevWeek: any) {
  const thisTotal = Object.values(thisWeek).reduce((sum: number, b: any) => sum + b.pickup, 0)
  const prevTotal = Object.values(prevWeek).reduce((sum: number, b: any) => sum + b.pickup, 0)

  if (prevTotal === 0) return 0

  return ((thisTotal - prevTotal) / prevTotal) * 100
}
