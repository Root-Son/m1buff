import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { duckQuery } from '@/lib/duck'
import { toDisplayPrice } from '@/lib/channel-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CHANNEL_GROUPS: Record<string, string> = {
  '야놀자(호텔)': 'OTA', '야놀자(모텔)': 'OTA', '아고다': 'OTA',
  '여기어때': 'OTA', '씨트립': 'OTA', '부킹닷컴': 'OTA',
  '익스피디아': 'OTA', '네이버': 'OTA', '트립토파즈': 'OTA',
  '에어비앤비': '에어비앤비',
  '내부채널_어스앱': '자사채널', '내부채널_어스(WEB)': '자사채널', '내부채널_직접예약': '자사채널',
  '내부채널_단체': 'B2B', '내부채널_기업체': 'B2B', '내부채널_홀세일': 'B2B',
  '내부채널_홀세일(선수금)': 'B2B', '내부채널_복지몰': 'B2B', '내부채널_부킹엔진': 'B2B',
  '내부채널_홈쇼핑': '홈쇼핑', '내부채널_OD': 'OD',
  '내부채널_LS': 'LS', 'LS_직계약': 'LS', 'LS_리버스': 'LS', 'LS_제휴부동산': 'LS',
  '내부채널_무료': '무숙', '임직원_무료숙박': '무숙',
  '내부채널_대관': '기타', '내부채널_임시': '기타',
}

function getChannelGroup(channel: string): string {
  return CHANNEL_GROUPS[channel] || '기타'
}

function getISOWeek(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

function getWeekRange(weekOffset: number) {
  const today = new Date()
  const currentISOWeek = getISOWeek(today)
  const targetWeek = currentISOWeek + weekOffset
  const jan4 = new Date(today.getFullYear(), 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (targetWeek - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch')
  const weekOffset = parseInt(searchParams.get('weekOffset') || '0')
  const roomType = searchParams.get('roomType') || ''

  if (!branch || branch === '전지점') {
    return NextResponse.json({ error: 'Branch required' }, { status: 400 })
  }

  try {
    const { monday, sunday } = getWeekRange(weekOffset)
    const startDate = monday.toISOString().split('T')[0]
    const endDate = sunday.toISOString().split('T')[0]

    // D-7, D-1 범위
    const d7Mon = new Date(monday); d7Mon.setDate(d7Mon.getDate() - 7)
    const d7Sun = new Date(sunday); d7Sun.setDate(d7Sun.getDate() - 7)
    const d1Mon = new Date(monday); d1Mon.setDate(d1Mon.getDate() - 1)
    const d1Sun = new Date(sunday); d1Sun.setDate(d1Sun.getDate() - 1)

    const escapedBranch = branch.replace(/'/g, "''")

    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0]
    const todayTs = `${today} 23:59:59`
    const d7Ts = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return `${d.toISOString().split('T')[0]} 23:59:59` })()
    const d1Ts = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.toISOString().split('T')[0]} 23:59:59` })()

    // 1. Duck: 현재 OCC/ADR + D-7/D-1 (부킹 페이스 스냅샷) 한방 쿼리
    const [occResult, paceResult] = await Promise.all([
      // 현재 OCC (재실 기반)
      duckQuery(`
        SELECT
          CAST(f.date AS VARCHAR) as date,
          f.rt_name as room_type,
          SUM(f.oc_rn) as sold,
          MAX(s.activeRooms) as activeRooms,
          SUM(CASE WHEN f.oc_rv > 0 THEN f.oc_rv ELSE 0 END) as revenue,
          SUM(CASE WHEN f.oc_rv > 0 THEN f.oc_rn ELSE 0 END) as paidRn
        FROM fact_reservation_event f
        LEFT JOIN staging_stat_daily s
          ON CAST(f.date AS VARCHAR) = CAST(s.date AS VARCHAR)
          AND f.branchId = s.branchId AND f.roomtypeId = s.roomtypeId
        WHERE f.event = '재실' AND f.isSales = true AND f.c_name NOT LIKE 'LS_%' AND f.c_name != '내부채널_LS'
          AND f.b_name = '${escapedBranch}'
          AND CAST(f.date AS VARCHAR) >= '${startDate}' AND CAST(f.date AS VARCHAR) <= '${endDate}'
        GROUP BY CAST(f.date AS VARCHAR), f.rt_name
        ORDER BY CAST(f.date AS VARCHAR), f.rt_name
      `),
      // D-7/D-1 부킹 페이스: staging_reservation으로 스냅샷
      duckQuery(`
        WITH dates AS (
          SELECT UNNEST(generate_series(DATE '${startDate}', DATE '${endDate}', INTERVAL 1 DAY)) as target_date
        ),
        avail AS (
          SELECT date, roomtypeId, SUM(activeRooms) as activeRooms
          FROM staging_stat_daily
          WHERE branchId = (SELECT id FROM dim_branch WHERE name = '${escapedBranch}' LIMIT 1)
            AND roomtypeId <> '0'
            AND date BETWEEN DATE '${startDate}' AND DATE '${endDate}'
          GROUP BY date, roomtypeId
        ),
        cur AS (
          SELECT
            CAST(d.target_date AS VARCHAR) as target_date,
            rt.name as rt_name,
            r.roomtypeId,
            COUNT(DISTINCT r.id) as booked
          FROM dates d
          JOIN staging_reservation r ON r.checkIn <= d.target_date AND r.checkOut > d.target_date
          JOIN dim_branch b ON r.branchId = b.id
          JOIN dim_roomtype rt ON r.roomtypeId = rt.id
          WHERE b.name = '${escapedBranch}'
            AND r.reservedAt <= TIMESTAMP '${todayTs}'
            AND (r.canceledAt IS NULL OR r.canceledAt > TIMESTAMP '${todayTs}')
            AND r.status IN ('settled', 'wait')
          GROUP BY CAST(d.target_date AS VARCHAR), rt.name, r.roomtypeId
        ),
        d7 AS (
          SELECT
            CAST(d.target_date AS VARCHAR) as target_date,
            rt.name as rt_name,
            r.roomtypeId,
            COUNT(DISTINCT r.id) as booked
          FROM dates d
          JOIN staging_reservation r ON r.checkIn <= d.target_date AND r.checkOut > d.target_date
          JOIN dim_branch b ON r.branchId = b.id
          JOIN dim_roomtype rt ON r.roomtypeId = rt.id
          WHERE b.name = '${escapedBranch}'
            AND r.reservedAt <= TIMESTAMP '${d7Ts}'
            AND (r.canceledAt IS NULL OR r.canceledAt > TIMESTAMP '${d7Ts}')
            AND r.status IN ('settled', 'wait')
          GROUP BY CAST(d.target_date AS VARCHAR), rt.name, r.roomtypeId
        ),
        d1_cte AS (
          SELECT
            CAST(d.target_date AS VARCHAR) as target_date,
            rt.name as rt_name,
            r.roomtypeId,
            COUNT(DISTINCT r.id) as booked
          FROM dates d
          JOIN staging_reservation r ON r.checkIn <= d.target_date AND r.checkOut > d.target_date
          JOIN dim_branch b ON r.branchId = b.id
          JOIN dim_roomtype rt ON r.roomtypeId = rt.id
          WHERE b.name = '${escapedBranch}'
            AND r.reservedAt <= TIMESTAMP '${d1Ts}'
            AND (r.canceledAt IS NULL OR r.canceledAt > TIMESTAMP '${d1Ts}')
            AND r.status IN ('settled', 'wait')
          GROUP BY CAST(d.target_date AS VARCHAR), rt.name, r.roomtypeId
        )
        SELECT
          cur.target_date as date,
          cur.rt_name as room_type,
          cur.booked as cur_booked,
          d7.booked as d7_booked,
          d1_cte.booked as d1_booked,
          a.activeRooms
        FROM cur
        LEFT JOIN d7 ON d7.target_date = cur.target_date AND d7.roomtypeId = cur.roomtypeId
        LEFT JOIN d1_cte ON d1_cte.target_date = cur.target_date AND d1_cte.roomtypeId = cur.roomtypeId
        LEFT JOIN avail a ON a.date = CAST(cur.target_date AS DATE) AND a.roomtypeId = cur.roomtypeId
        ORDER BY cur.target_date, cur.rt_name
      `),
    ])

    const roomTypes = [...new Set(paceResult.rows.map((r: any) => r.room_type).filter(Boolean))].sort() as string[]

    // OCC/D-7/D-1 모두 paceResult(staging_reservation) 기준으로 통일
    const occMap: Record<string, number> = {}
    const d7Map: Record<string, number> = {}
    const d1Map: Record<string, number> = {}
    paceResult.rows.forEach((r: any) => {
      const d = String(r.date).substring(0, 10)
      const key = `${d}_${r.room_type}`
      const active = r.activeRooms || 0
      if (active > 0) {
        occMap[key] = Math.min(Math.round((r.cur_booked || 0) / active * 10000) / 10000, 1)
        d7Map[key] = Math.min(Math.round((r.d7_booked || 0) / active * 10000) / 10000, 1)
        d1Map[key] = Math.min(Math.round((r.d1_booked || 0) / active * 10000) / 10000, 1)
      }
    })

    // ADR은 재실(occResult)에서 가져오기
    const adrMap: Record<string, number> = {}
    occResult.rows.forEach((r: any) => {
      const d = String(r.date).substring(0, 10)
      const key = `${d}_${r.room_type}`
      adrMap[key] = r.paidRn > 0 ? Math.round(r.revenue / r.paidRn) : 0
    })

    // 2. raw_bookings: LoS + 채널
    let allBookings: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from('raw_bookings')
        .select('check_in_date, roomtype, nights, reservation_channel')
        .eq('branch_name', branch)
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)
        .range(from, from + pageSize - 1)
      if (pageError) throw pageError
      if (!page || page.length === 0) break
      allBookings = allBookings.concat(page)
      if (page.length < pageSize) break
      from += pageSize
    }

    // 3. YOLO 가격 + 가드레일
    const [{ data: yoloData }, { data: guideData }] = await Promise.all([
      supabase.from('yolo_prices').select('date, room_type, price')
        .eq('branch_name', branch).gte('date', startDate).lte('date', endDate),
      supabase.from('price_guide').select('date, room_type, min_price')
        .eq('branch_name', branch).gte('date', startDate).lte('date', endDate),
    ])

    // LoS
    const losMap: Record<string, { total: number; count: number }> = {}
    allBookings.forEach((row: any) => {
      const dateStr = String(row.check_in_date).split('T')[0].split(' ')[0]
      const key = `${dateStr}_${row.roomtype}`
      if (!losMap[key]) losMap[key] = { total: 0, count: 0 }
      losMap[key].total += row.nights || 0
      losMap[key].count += 1
    })
    const losAverages: Record<string, number> = {}
    Object.entries(losMap).forEach(([key, val]) => {
      losAverages[key] = val.count > 0 ? val.total / val.count : 0
    })

    // 채널 비중
    const channelMap: Record<string, Record<string, number>> = {}
    allBookings.forEach((row: any) => {
      const dateStr = String(row.check_in_date).split('T')[0].split(' ')[0]
      const key = `${dateStr}_${row.roomtype}`
      const group = getChannelGroup(row.reservation_channel || '')
      if (!channelMap[key]) channelMap[key] = {}
      channelMap[key][group] = (channelMap[key][group] || 0) + 1
    })
    const channelRatios: Record<string, Record<string, number>> = {}
    Object.entries(channelMap).forEach(([key, groups]) => {
      const total = Object.values(groups).reduce((sum, cnt) => sum + cnt, 0)
      channelRatios[key] = {}
      Object.entries(groups).forEach(([group, count]) => {
        channelRatios[key][group] = total > 0 ? (count / total) * 100 : 0
      })
    })

    // 병합 (paceResult 기준 — OCC/D-7/D-1 동일 소스)
    const mergedData = paceResult.rows.map((row: any) => {
      const dateStr = String(row.date).substring(0, 10)
      const key = `${dateStr}_${row.room_type}`

      const yolo = yoloData?.find((y: any) => y.date === dateStr && y.room_type === row.room_type)
      const guide = guideData?.find((g: any) => g.date === dateStr && g.room_type === row.room_type)

      return {
        date: dateStr,
        room_type: row.room_type,
        occ: occMap[key] ?? 0,
        occ_7d_ago: d7Map[key] ?? 0,
        occ_1d_ago: d1Map[key] ?? 0,
        adr: adrMap[key] ?? 0,
        yolo_price: yolo?.price ? toDisplayPrice(branch!, yolo.price) : null,
        guardrail_price: guide?.min_price || null,
        avg_los: losAverages[key] || 0,
        channel_ratios: channelRatios[key] || {},
      }
    }).filter((r: any) => r.room_type)

    const filteredData = (roomType
      ? mergedData.filter((d: any) => d.room_type === roomType)
      : mergedData
    ).sort((a: any, b: any) => a.date.localeCompare(b.date))

    return NextResponse.json({ roomTypes, days: filteredData })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
