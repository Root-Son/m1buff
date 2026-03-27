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
  '내부채널_LS': 'LS', 'LS_직계약': 'LS', 'LS_리버스': 'LS', 'LS_제휴부동산': 'LS',
}

const MAIN_CHANNELS = ['OTA', '에어비앤비', 'B2B', '자사채널', 'LS']

function getChannelGroup(channel: string): string {
  return CHANNEL_GROUPS[channel] || '기타'
}

function getSunSatWeeks(year: number, month: number) {
  const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0)
  const lastDayStr = fmt(lastDay)
  const firstDay = new Date(year, month - 1, 1)
  const firstDow = firstDay.getDay()
  const weeks: { week_num: number; start_date: string; end_date: string }[] = []
  let cursor = new Date(firstDay)
  if (firstDow !== 0) cursor.setDate(cursor.getDate() - firstDow)
  let weekNum = 1
  while (fmt(cursor) <= lastDayStr) {
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const startStr = fmt(cursor) < firstDayStr ? firstDayStr : fmt(cursor)
    const endStr = fmt(weekEnd) > lastDayStr ? lastDayStr : fmt(weekEnd)
    weeks.push({ week_num: weekNum, start_date: startStr, end_date: endStr })
    weekNum++
    cursor = new Date(weekEnd)
    cursor.setDate(cursor.getDate() + 1)
  }
  return weeks
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 페이지네이션 헬퍼
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
  const noCache = searchParams.get('nocache') === '1'

  try {
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1
    const year = 2026

    // ★ 캐시 우선: dashboard_cache에서 읽기 (전지점 all만 캐시)
    if (branch === 'all' && !noCache) {
      const cacheKey = `topline:all:${year}:${month}`
      const { data: cached } = await supabase
        .from('dashboard_cache')
        .select('data, updated_at')
        .eq('cache_key', cacheKey)
        .single()

      if (cached?.data) {
        const response = NextResponse.json({ ...cached.data, cached: true, cached_at: cached.updated_at })
        response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return response
      }
    }

    // 캐시 미스 → 기존 로직
    const weeks = getSunSatWeeks(year, month)
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = fmt(new Date(year, month, 0))
    const prevYear = year - 1
    const prevWeeks = getSunSatWeeks(prevYear, month)
    const prevMonthStart = `${prevYear}-${String(month).padStart(2, '0')}-01`
    const prevMonthEnd = fmt(new Date(prevYear, month, 0))

    const branchFilter = (q: any) => branch !== 'all' ? q.eq('branch_name', branch) : q

    // ★ 모든 데이터를 병렬로 가져오기
    const [rpcResult, allCiData, prevYearData, allOccData, allPickupData, targetData] = await Promise.all([
      // 1. RPC (CI 합계)
      supabase.rpc('get_topline_weekly_checkin', { p_branch: branch, p_month: month, p_year: year }),
      // 2. 올해 체크인 raw_bookings
      fetchAllPages(([s, e]) => {
        let q = supabase.from('raw_bookings')
          .select('check_in_date, check_out_date, payment_amount, reservation_created_at, reservation_channel, nights')
          .gte('check_in_date', monthStart).lte('check_in_date', monthEnd)
        return branchFilter(q).range(s, e)
      }),
      // 3. 전년 체크인 raw_bookings
      fetchAllPages(([s, e]) => {
        let q = supabase.from('raw_bookings')
          .select('check_in_date, payment_amount, reservation_channel, nights')
          .gte('check_in_date', prevMonthStart).lte('check_in_date', prevMonthEnd)
        return branchFilter(q).range(s, e)
      }),
      // 4. OCC 월 전체 한번에
      fetchAllPages(([s, e]) => {
        let q = supabase.from('branch_room_occ')
          .select('date, available_rooms, sold_rooms')
          .gte('date', monthStart).lte('date', monthEnd)
        return branchFilter(q).range(s, e)
      }),
      // 5. 픽업 기준 raw_bookings
      fetchAllPages(([s, e]) => {
        let q = supabase.from('raw_bookings')
          .select('reservation_created_at, payment_amount, reservation_channel, nights')
          .gte('reservation_created_at', monthStart + ' 00:00:00')
          .lte('reservation_created_at', monthEnd + ' 23:59:59')
        return branchFilter(q).range(s, e)
      }),
      // 6. 목표
      supabase.from('targets').select('branch_name, target_amount')
        .eq('month', month).eq('year', year).neq('branch_name', '전지점'),
    ])

    if (rpcResult.error) throw rpcResult.error

    const totalCI = (rpcResult.data || []).reduce((sum: number, w: any) => sum + (w.ci_amount || 0), 0)

    const totalTarget = (targetData.data || [])
      .filter((row: any) => branch === 'all' || normalizeBranchName(row.branch_name) === branch)
      .reduce((sum: number, row: any) => sum + (row.target_amount || 0), 0)

    const achievement = totalTarget > 0 ? (totalCI / totalTarget) * 100 : 0

    // 전년 주차별 ADR 계산
    const prevYearWeeklyAdr: Record<number, { wdRev: number; wdNights: number; weRev: number; weNights: number; channelData: Record<string, { amount: number; nights: number }> }> = {}
    prevWeeks.forEach(pw => {
      const wBookings = prevYearData.filter((r: any) => r.check_in_date >= pw.start_date && r.check_in_date <= pw.end_date)
      let wdRev = 0, wdNights = 0, weRev = 0, weNights = 0
      const chData: Record<string, { amount: number; nights: number }> = {}
      wBookings.forEach((r: any) => {
        const nights = r.nights || 0
        if (nights <= 0) return
        if (!r.payment_amount || r.payment_amount <= 0) return
        const perNight = r.payment_amount / nights
        const ci = new Date(r.check_in_date)
        for (let n = 0; n < nights; n++) {
          const sd = new Date(ci); sd.setDate(sd.getDate() + n)
          const sStr = fmt(sd)
          if (sStr >= pw.start_date && sStr <= pw.end_date) {
            if (sd.getDay() === 5 || sd.getDay() === 6) { weRev += perNight; weNights++ }
            else { wdRev += perNight; wdNights++ }
          }
        }
        const group = getChannelGroup(r.reservation_channel || '')
        if (!chData[group]) chData[group] = { amount: 0, nights: 0 }
        chData[group].amount += r.payment_amount || 0
        chData[group].nights += r.nights || 0
      })
      prevYearWeeklyAdr[pw.week_num] = { wdRev, wdNights, weRev, weNights, channelData: chData }
    })

    // 일별 매출 맵
    const dailyCI: Record<string, number> = {}
    allCiData.forEach((r: any) => {
      dailyCI[r.check_in_date] = (dailyCI[r.check_in_date] || 0) + (r.payment_amount || 0)
    })

    // 주차별 집계 (OCC는 메모리에서 필터)
    const weeksWithLabels = weeks.map(week => {
      const startDate = new Date(week.start_date)
      const endDate = new Date(week.end_date)

      // CI 합산
      let weekCI = 0
      const cur = new Date(startDate)
      while (cur <= endDate) { weekCI += dailyCI[fmt(cur)] || 0; cur.setDate(cur.getDate() + 1) }

      // 체크인 예약 필터
      const weekBookings = allCiData.filter((r: any) => r.check_in_date >= week.start_date && r.check_in_date <= week.end_date)

      // 픽업 시점 분석
      const pickupByWeek: Record<string, { amount: number; nights: number }> = {}
      weekBookings.forEach((r: any) => {
        const createdDate = r.reservation_created_at?.split(' ')[0] || r.reservation_created_at?.split('T')[0]
        if (!createdDate) return
        const cd = new Date(createdDate)
        const sun = new Date(cd); sun.setDate(sun.getDate() - cd.getDay())
        const sat = new Date(sun); sat.setDate(sat.getDate() + 6)
        const label = `${sun.getMonth()+1}/${sun.getDate()}~${sat.getMonth()+1}/${sat.getDate()}`
        if (!pickupByWeek[label]) pickupByWeek[label] = { amount: 0, nights: 0 }
        pickupByWeek[label].amount += r.payment_amount || 0
        pickupByWeek[label].nights += r.nights || 0
      })
      const pickupTop5 = Object.entries(pickupByWeek)
        .sort((a, b) => b[1].amount - a[1].amount).slice(0, 8)
        .map(([label, d]) => ({ week: label, pct: weekCI > 0 ? Math.round(d.amount / weekCI * 100) : 0, adr: d.nights > 0 ? Math.round(d.amount / d.nights) : 0 }))

      // 채널 분포
      const chMap: Record<string, { amount: number; nights: number; count: number }> = {}
      weekBookings.forEach((r: any) => {
        const g = getChannelGroup(r.reservation_channel || '')
        if (!chMap[g]) chMap[g] = { amount: 0, nights: 0, count: 0 }
        chMap[g].amount += r.payment_amount || 0
        chMap[g].nights += r.nights || 0
        chMap[g].count += 1
      })
      const channelDist = [...MAIN_CHANNELS, '기타'].map(ch => {
        const d = ch === '기타'
          ? Object.entries(chMap).filter(([k]) => !MAIN_CHANNELS.includes(k)).reduce((s, [, v]) => ({ amount: s.amount + v.amount, nights: s.nights + v.nights, count: s.count + v.count }), { amount: 0, nights: 0, count: 0 })
          : chMap[ch] || { amount: 0, nights: 0, count: 0 }
        return { channel: ch, pct: weekCI > 0 ? Math.round(d.amount / weekCI * 100) : 0, adr: d.nights > 0 ? Math.round(d.amount / d.nights) : 0, los: d.count > 0 ? Math.round(d.nights / d.count * 10) / 10 : 0 }
      }).filter(c => c.pct > 0)

      // OCC (메모리에서 필터)
      const weekOcc = allOccData.filter((r: any) => r.date >= week.start_date && r.date <= week.end_date)
      let wdAvail = 0, wdSold = 0, weAvail = 0, weSold = 0
      weekOcc.forEach((row: any) => {
        const isWE = new Date(row.date).getDay() === 5 || new Date(row.date).getDay() === 6
        if (isWE) { weAvail += row.available_rooms || 0; weSold += row.sold_rooms || 0 }
        else { wdAvail += row.available_rooms || 0; wdSold += row.sold_rooms || 0 }
      })

      // 평일/주말 일수
      let weekdayDays = 0, weekendDays = 0
      const dc = new Date(startDate)
      while (dc <= endDate) { if (dc.getDay() === 5 || dc.getDay() === 6) weekendDays++; else weekdayDays++; dc.setDate(dc.getDate() + 1) }

      // ADR (raw_bookings 기반)
      let wdRevRb = 0, wdNightsRb = 0, weRevRb = 0, weNightsRb = 0
      weekBookings.forEach((r: any) => {
        const nights = r.nights || 0
        if (nights <= 0) return
        if (!r.payment_amount || r.payment_amount <= 0) return
        const perNight = r.payment_amount / nights
        const ci = new Date(r.check_in_date)
        for (let n = 0; n < nights; n++) {
          const sd = new Date(ci); sd.setDate(sd.getDate() + n)
          const sStr = fmt(sd)
          if (sStr >= week.start_date && sStr <= week.end_date) {
            if (sd.getDay() === 5 || sd.getDay() === 6) { weRevRb += perNight; weNightsRb++ }
            else { wdRevRb += perNight; wdNightsRb++ }
          }
        }
      })

      // YoY
      const prev = prevYearWeeklyAdr[week.week_num]
      const prevWdAdr = prev?.wdNights > 0 ? Math.round(prev.wdRev / prev.wdNights) : 0
      const prevWeAdr = prev?.weNights > 0 ? Math.round(prev.weRev / prev.weNights) : 0
      const curWdAdr = wdNightsRb > 0 ? Math.round(wdRevRb / wdNightsRb) : 0
      const curWeAdr = weNightsRb > 0 ? Math.round(weRevRb / weNightsRb) : 0

      const channelDistWithYoy = channelDist.map((c: any) => {
        let prevChData: { amount: number; nights: number } | undefined
        if (prev) {
          prevChData = c.channel === '기타'
            ? Object.entries(prev.channelData).filter(([k]) => !MAIN_CHANNELS.includes(k)).reduce((s, [, v]) => ({ amount: s.amount + v.amount, nights: s.nights + v.nights }), { amount: 0, nights: 0 })
            : prev.channelData[c.channel]
        }
        const prevAdr = prevChData && prevChData.nights > 0 ? Math.round(prevChData.amount / prevChData.nights) : 0
        return { ...c, adr_yoy: prevAdr > 0 && c.adr > 0 ? Math.round((c.adr - prevAdr) / prevAdr * 100) : null }
      })

      const totalAvailable = wdAvail + weAvail
      const totalSold = wdSold + weSold

      return {
        week_num: week.week_num, start_date: week.start_date, end_date: week.end_date,
        ci_amount: weekCI, label: `${startDate.getDate()}~${endDate.getDate()}`,
        avg_occ: totalAvailable > 0 ? Math.round(totalSold / totalAvailable * 100) : 0,
        total_available: totalAvailable, total_sold: totalSold,
        weekday_days: weekdayDays, weekend_days: weekendDays,
        weekday_occ: wdAvail > 0 ? Math.round(wdSold / wdAvail * 100) : 0,
        weekend_occ: weAvail > 0 ? Math.round(weSold / weAvail * 100) : 0,
        weekday_adr: curWdAdr, weekend_adr: curWeAdr,
        weekday_adr_yoy: prevWdAdr > 0 && curWdAdr > 0 ? Math.round((curWdAdr - prevWdAdr) / prevWdAdr * 100) : null,
        weekend_adr_yoy: prevWeAdr > 0 && curWeAdr > 0 ? Math.round((curWeAdr - prevWeAdr) / prevWeAdr * 100) : null,
        pickup_top5: pickupTop5, channel_dist: channelDistWithYoy,
      }
    })

    // 픽업 기준 탑라인
    const pickupWeeks = weeks.map(week => {
      const startDate = new Date(week.start_date)
      const wBookings = allPickupData.filter((r: any) => {
        const d = r.reservation_created_at?.split(' ')[0] || r.reservation_created_at?.split('T')[0]
        return d >= week.start_date && d <= week.end_date
      })
      const totalAmount = wBookings.reduce((s: number, r: any) => s + (r.payment_amount || 0), 0)
      const totalNights = wBookings.reduce((s: number, r: any) => s + (r.nights || 0), 0)

      const chData: Record<string, { amount: number; nights: number; count: number }> = {}
      wBookings.forEach((r: any) => {
        const g = getChannelGroup(r.reservation_channel || '')
        if (!chData[g]) chData[g] = { amount: 0, nights: 0, count: 0 }
        chData[g].amount += r.payment_amount || 0
        chData[g].nights += r.nights || 0
        chData[g].count += 1
      })
      const chDist = [...MAIN_CHANNELS, '기타'].map(ch => {
        const d = ch === '기타'
          ? Object.entries(chData).filter(([k]) => !MAIN_CHANNELS.includes(k)).reduce((s, [, v]) => ({ amount: s.amount + v.amount, nights: s.nights + v.nights, count: s.count + v.count }), { amount: 0, nights: 0, count: 0 })
          : chData[ch] || { amount: 0, nights: 0, count: 0 }
        return { channel: ch, pct: totalAmount > 0 ? Math.round(d.amount / totalAmount * 100) : 0, adr: d.nights > 0 ? Math.round(d.amount / d.nights) : 0, los: d.count > 0 ? Math.round(d.nights / d.count * 10) / 10 : 0 }
      }).filter(c => c.pct > 0)

      return {
        week_num: week.week_num, label: `${startDate.getDate()}~${new Date(week.end_date).getDate()}`,
        pickup_amount: totalAmount, booking_count: wBookings.length,
        adr: totalNights > 0 ? Math.round(totalAmount / totalNights) : 0, channel_dist: chDist,
      }
    })

    const payload = {
      branch, month, year, total_ci: totalCI, total_target: totalTarget, achievement_rate: achievement,
      weeks: weeksWithLabels, pickup_weeks: pickupWeeks,
      total_pickup: pickupWeeks.reduce((s, w) => s + w.pickup_amount, 0),
    }

    // ★ 전지점(all) 결과를 cache에 자동 저장 (다음 요청부터 캐시 히트)
    if (branch === 'all') {
      const cacheKey = `topline:all:${year}:${month}`
      supabase.from('dashboard_cache').upsert({
        cache_key: cacheKey, data: payload, updated_at: new Date().toISOString()
      }, { onConflict: 'cache_key' }).then(() => {}).catch(() => {})
    }

    const response = NextResponse.json(payload)
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error: any) {
    console.error('Topline API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
