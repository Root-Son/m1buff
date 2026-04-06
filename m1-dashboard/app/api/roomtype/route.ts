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

// 지점명 → branchId 매핑 (duck은 branchId 기반)
async function getBranchId(branchName: string): Promise<string | null> {
  const result = await duckQuery(`
    SELECT id FROM dim_branch WHERE name = '${branchName.replace(/'/g, "''")}' LIMIT 1
  `)
  return result.rows.length > 0 ? result.rows[0].id : null
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

    // 7일 전, 1일 전 날짜 계산
    const d7Start = new Date(monday); d7Start.setDate(d7Start.getDate() - 7)
    const d7End = new Date(sunday); d7End.setDate(d7End.getDate() - 7)
    const d1Start = new Date(monday); d1Start.setDate(d1Start.getDate() - 1)
    const d1End = new Date(sunday); d1End.setDate(d1End.getDate() - 1)

    const branchId = await getBranchId(branch)
    if (!branchId) {
      return NextResponse.json({ error: `Branch not found: ${branch}` }, { status: 404 })
    }

    const escapedBranch = branch.replace(/'/g, "''")

    // 1. Duck: 룸타입 목록 + OCC/ADR (이번주 + D-7 + D-1)
    const [occResult, d7Result, d1Result] = await Promise.all([
      // 이번 주
      duckQuery(`
        WITH fact AS (
          SELECT date, roomtypeId, rt_name,
                 SUM(oc_rn) AS rn, SUM(oc_rv) AS rv
          FROM fact_reservation_event
          WHERE event = '재실' AND isSales = true
            AND branchId = '${branchId}'
            AND date BETWEEN '${startDate}' AND '${endDate}'
          GROUP BY date, roomtypeId, rt_name
        ),
        avail AS (
          SELECT date, roomtypeId,
                 SUM(activeRooms - stops) AS avail
          FROM staging_stat_daily
          WHERE branchId = '${branchId}'
            AND roomtypeId <> '0'
            AND date BETWEEN '${startDate}' AND '${endDate}'
          GROUP BY date, roomtypeId
        )
        SELECT f.date, f.rt_name AS room_type,
               ROUND(f.rn::DOUBLE / NULLIF(a.avail, 0), 4) AS occ,
               ROUND(f.rv / NULLIF(f.rn, 0)) AS adr,
               a.avail
        FROM avail a
        LEFT JOIN fact f ON f.date = a.date AND f.roomtypeId = a.roomtypeId
        ORDER BY a.date, f.rt_name
      `),
      // D-7
      duckQuery(`
        WITH fact AS (
          SELECT date, roomtypeId, rt_name,
                 SUM(oc_rn) AS rn
          FROM fact_reservation_event
          WHERE event = '재실' AND isSales = true
            AND branchId = '${branchId}'
            AND date BETWEEN '${d7Start.toISOString().split('T')[0]}' AND '${d7End.toISOString().split('T')[0]}'
          GROUP BY date, roomtypeId, rt_name
        ),
        avail AS (
          SELECT date, roomtypeId,
                 SUM(activeRooms - stops) AS avail
          FROM staging_stat_daily
          WHERE branchId = '${branchId}'
            AND roomtypeId <> '0'
            AND date BETWEEN '${d7Start.toISOString().split('T')[0]}' AND '${d7End.toISOString().split('T')[0]}'
          GROUP BY date, roomtypeId
        )
        SELECT a.date + INTERVAL 7 DAY AS date, f.rt_name AS room_type,
               ROUND(COALESCE(f.rn, 0)::DOUBLE / NULLIF(a.avail, 0), 4) AS occ_7d_ago
        FROM avail a
        LEFT JOIN fact f ON f.date = a.date AND f.roomtypeId = a.roomtypeId
      `),
      // D-1
      duckQuery(`
        WITH fact AS (
          SELECT date, roomtypeId, rt_name,
                 SUM(oc_rn) AS rn
          FROM fact_reservation_event
          WHERE event = '재실' AND isSales = true
            AND branchId = '${branchId}'
            AND date BETWEEN '${d1Start.toISOString().split('T')[0]}' AND '${d1End.toISOString().split('T')[0]}'
          GROUP BY date, roomtypeId, rt_name
        ),
        avail AS (
          SELECT date, roomtypeId,
                 SUM(activeRooms - stops) AS avail
          FROM staging_stat_daily
          WHERE branchId = '${branchId}'
            AND roomtypeId <> '0'
            AND date BETWEEN '${d1Start.toISOString().split('T')[0]}' AND '${d1End.toISOString().split('T')[0]}'
          GROUP BY date, roomtypeId
        )
        SELECT a.date + INTERVAL 1 DAY AS date, f.rt_name AS room_type,
               ROUND(COALESCE(f.rn, 0)::DOUBLE / NULLIF(a.avail, 0), 4) AS occ_1d_ago
        FROM avail a
        LEFT JOIN fact f ON f.date = a.date AND f.roomtypeId = a.roomtypeId
      `),
    ])

    // 룸타입 목록 추출
    const roomTypes = [...new Set(
      occResult.rows
        .filter((r: any) => r.room_type)
        .map((r: any) => r.room_type)
    )].sort() as string[]

    // 2. raw_bookings: LoS + 채널 (Supabase)
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

    // 3. YOLO 가격 (셋팅가 → 노출가로 표시)
    const { data: yoloData } = await supabase
      .from('yolo_prices')
      .select('date, room_type, price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // 4. 가드레일
    const { data: guideData } = await supabase
      .from('price_guide')
      .select('date, room_type, min_price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // LoS 집계
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

    // D-7, D-1 OCC를 lookup map으로
    const d7Map: Record<string, number> = {}
    d7Result.rows.forEach((r: any) => {
      const d = String(r.date).split('T')[0]
      d7Map[`${d}_${r.room_type}`] = r.occ_7d_ago || 0
    })
    const d1Map: Record<string, number> = {}
    d1Result.rows.forEach((r: any) => {
      const d = String(r.date).split('T')[0]
      d1Map[`${d}_${r.room_type}`] = r.occ_1d_ago || 0
    })

    // 병합
    const mergedData = occResult.rows.map((row: any) => {
      const dateStr = String(row.date).split('T')[0]
      const key = `${dateStr}_${row.room_type}`

      const yolo = yoloData?.find((y: any) => y.date === dateStr && y.room_type === row.room_type)
      const guide = guideData?.find((g: any) => g.date === dateStr && g.room_type === row.room_type)

      return {
        date: dateStr,
        room_type: row.room_type || '(unknown)',
        occ: row.occ ? Math.round(row.occ * 100) : 0,
        occ_7d_ago: d7Map[key] ? Math.round(d7Map[key] * 100) : 0,
        occ_1d_ago: d1Map[key] ? Math.round(d1Map[key] * 100) : 0,
        adr: row.adr || 0,
        yolo_price: yolo?.price ? toDisplayPrice(branch!, yolo.price) : null,
        guardrail_price: guide?.min_price || null,
        avg_los: losAverages[key] || 0,
        channel_ratios: channelRatios[key] || {},
      }
    }).filter((r: any) => r.room_type !== '(unknown)')

    const filteredData = roomType
      ? mergedData.filter((d: any) => d.room_type === roomType)
      : mergedData

    return NextResponse.json({
      roomTypes,
      days: filteredData,
    })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
