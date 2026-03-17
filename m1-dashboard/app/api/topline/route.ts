import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizeBranchName } from '@/lib/pricing-engine'

const CHANNEL_GROUPS: Record<string, string> = {
  '야놀자(호텔)': 'OTA', '야놀자(모텔)': 'OTA', '아고다': 'OTA',
  '여기어때': 'OTA', '씨트립': 'OTA', '부킹닷컴': 'OTA',
  '익스피디아': 'OTA', '네이버': 'OTA', '트립토파즈': 'OTA',
  '에어비앤비': '에어비앤비',
  '내부채널_어스앱': '자사채널', '내부채널_어스(WEB)': '자사채널', '내부채널_직접예약': '자사채널',
  '내부채널_단체': 'B2B', '내부채널_기업체': 'B2B', '내부채널_홀세일': 'B2B',
  '내부채널_홀세일(선수금)': 'B2B', '내부채널_복지몰': 'B2B', '내부채널_부킹엔진': 'B2B',
}

function getChannelGroup(channel: string): string {
  return CHANNEL_GROUPS[channel] || '기타'
}

// 해당 월의 일~토 기준 주차 생성 (월 범위 내로 클램핑)
function getSunSatWeeks(year: number, month: number) {
  const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0)
  const lastDayStr = fmt(lastDay)

  const firstDay = new Date(year, month - 1, 1)
  const firstDow = firstDay.getDay() // 0=일

  const weeks: { week_num: number; start_date: string; end_date: string }[] = []

  // 해당 월 1일이 속한 주의 일요일 찾기
  let cursor = new Date(firstDay)
  if (firstDow !== 0) {
    cursor.setDate(cursor.getDate() - firstDow)
  }

  let weekNum = 1
  while (fmt(cursor) <= lastDayStr) {
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6) // 토요일

    // 월 범위로 클램핑 (문자열 비교)
    const startStr = fmt(cursor) < firstDayStr ? firstDayStr : fmt(cursor)
    const endStr = fmt(weekEnd) > lastDayStr ? lastDayStr : fmt(weekEnd)

    weeks.push({
      week_num: weekNum,
      start_date: startStr,
      end_date: endStr,
    })
    weekNum++
    cursor = new Date(weekEnd)
    cursor.setDate(cursor.getDate() + 1)
  }

  return weeks
}

function fmt(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')

  try {
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
    const year = 2026

    // 일~토 기준 주차 생성
    const weeks = getSunSatWeeks(year, month)
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]

    // 체크인 기준 매출 (RPC로 월 전체)
    const { data: rpcData, error } = await supabase
      .rpc('get_topline_weekly_checkin', {
        p_branch: branch,
        p_month: month,
        p_year: year
      })

    if (error) {
      console.error('Topline RPC Error:', error)
      throw error
    }

    const totalCI = (rpcData || []).reduce((sum: number, week: any) => sum + (week.ci_amount || 0), 0)

    // 체크인 매출 + 픽업 시점 조회
    let allCiData: any[] = []
    let page = 0
    while (true) {
      let ciQuery = supabase
        .from('raw_bookings')
        .select('check_in_date, payment_amount, reservation_created_at, reservation_channel, nights')
        .gte('check_in_date', monthStart)
        .lte('check_in_date', monthEnd)
      if (branch !== 'all') {
        ciQuery = ciQuery.eq('branch_name', branch)
      }
      const { data: pageData } = await ciQuery.range(page * 1000, (page + 1) * 1000 - 1)
      if (!pageData || pageData.length === 0) break
      allCiData = allCiData.concat(pageData)
      if (pageData.length < 1000) break
      page++
    }

    // 일별 매출 맵
    const dailyCI: Record<string, number> = {}
    allCiData.forEach(r => {
      const d = r.check_in_date
      dailyCI[d] = (dailyCI[d] || 0) + (r.payment_amount || 0)
    })

    // 목표 매출
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

    // 주차별 OCC + CI 집계
    const weeksWithLabels = await Promise.all(weeks.map(async (week) => {
      const startDate = new Date(week.start_date)
      const endDate = new Date(week.end_date)

      // 주차별 CI 합산 + 픽업 주차 분석
      let weekCI = 0
      const cur = new Date(startDate)
      while (cur <= endDate) {
        weekCI += dailyCI[fmt(cur)] || 0
        cur.setDate(cur.getDate() + 1)
      }

      // 이 주차 체크인 예약들의 픽업 시점 분석
      const weekBookings = allCiData.filter(r =>
        r.check_in_date >= week.start_date && r.check_in_date <= week.end_date
      )
      const pickupByWeek: Record<string, { amount: number; nights: number }> = {}
      weekBookings.forEach(r => {
        const createdDate = r.reservation_created_at?.split(' ')[0] || r.reservation_created_at?.split('T')[0]
        if (!createdDate) return
        const cd = new Date(createdDate)
        const dow = cd.getDay()
        const sun = new Date(cd)
        sun.setDate(sun.getDate() - dow)
        const sat = new Date(sun)
        sat.setDate(sat.getDate() + 6)
        const weekLabel = `${sun.getMonth()+1}/${sun.getDate()}~${sat.getMonth()+1}/${sat.getDate()}`
        if (!pickupByWeek[weekLabel]) pickupByWeek[weekLabel] = { amount: 0, nights: 0 }
        pickupByWeek[weekLabel].amount += r.payment_amount || 0
        pickupByWeek[weekLabel].nights += r.nights || 0
      })
      const pickupTop5 = Object.entries(pickupByWeek)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 5)
        .map(([label, d]) => ({
          week: label,
          pct: weekCI > 0 ? Math.round(d.amount / weekCI * 1000) / 10 : 0,
          adr: d.nights > 0 ? Math.round(d.amount / d.nights) : 0,
        }))

      // 채널 분포
      const channelData: Record<string, { amount: number; nights: number }> = {}
      weekBookings.forEach(r => {
        const group = getChannelGroup(r.reservation_channel || '')
        if (!channelData[group]) channelData[group] = { amount: 0, nights: 0 }
        channelData[group].amount += r.payment_amount || 0
        channelData[group].nights += r.nights || 0
      })
      const MAIN_CHANNELS = ['OTA', '에어비앤비', 'B2B', '자사채널']
      const channelDist = [...MAIN_CHANNELS, '기타'].map(ch => {
        let d: { amount: number; nights: number }
        if (ch === '기타') {
          d = Object.entries(channelData)
            .filter(([k]) => !MAIN_CHANNELS.includes(k))
            .reduce((s, [, v]) => ({ amount: s.amount + v.amount, nights: s.nights + v.nights }), { amount: 0, nights: 0 })
        } else {
          d = channelData[ch] || { amount: 0, nights: 0 }
        }
        return {
          channel: ch,
          pct: weekCI > 0 ? Math.round(d.amount / weekCI * 1000) / 10 : 0,
          adr: d.nights > 0 ? Math.round(d.amount / d.nights) : 0,
        }
      }).filter(c => c.pct > 0)

      // OCC 조회
      let occQuery = supabase
        .from('branch_room_occ')
        .select('date, occ, available_rooms, sold_rooms, revenue')
        .gte('date', week.start_date)
        .lte('date', week.end_date)

      if (branch !== 'all') {
        occQuery = occQuery.eq('branch_name', branch)
      }

      const { data: occData } = await occQuery

      // 평일/주말(금,토) 분리 집계
      let wdAvail = 0, wdSold = 0, wdRev = 0
      let weAvail = 0, weSold = 0, weRev = 0
      occData?.forEach((row: any) => {
        const day = new Date(row.date).getDay()
        const isWeekend = day === 5 || day === 6
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
        week_num: week.week_num,
        start_date: week.start_date,
        end_date: week.end_date,
        ci_amount: weekCI,
        label: `${startDate.getDate()}~${endDate.getDate()}`,
        avg_occ: Math.round(avgOcc * 1000) / 10,
        total_available: totalAvailable,
        total_sold: totalSold,
        weekday_occ: wdAvail > 0 ? Math.round((wdSold / wdAvail) * 1000) / 10 : 0,
        weekend_occ: weAvail > 0 ? Math.round((weSold / weAvail) * 1000) / 10 : 0,
        weekday_adr: wdSold > 0 ? Math.round(wdRev / wdSold) : 0,
        weekend_adr: weSold > 0 ? Math.round(weRev / weSold) : 0,
        pickup_top5: pickupTop5,
        channel_dist: channelDist,
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
