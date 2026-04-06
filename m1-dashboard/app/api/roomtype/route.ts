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

    // 1. Duck: OCC/ADR by roomtype (dynamic-pricing과 동일 쿼리)
    const [occResult, d7Result, d1Result] = await Promise.all([
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
        WHERE f.event = '재실' AND f.isSales = true
          AND f.b_name = '${escapedBranch}'
          AND CAST(f.date AS VARCHAR) >= '${startDate}' AND CAST(f.date AS VARCHAR) <= '${endDate}'
        GROUP BY CAST(f.date AS VARCHAR), f.rt_name
      `),
      duckQuery(`
        SELECT
          STRFTIME(CAST(f.date AS DATE) + INTERVAL 7 DAY, '%Y-%m-%d') as date,
          f.rt_name as room_type,
          SUM(f.oc_rn) as sold,
          MAX(s.activeRooms) as activeRooms
        FROM fact_reservation_event f
        LEFT JOIN staging_stat_daily s
          ON CAST(f.date AS VARCHAR) = CAST(s.date AS VARCHAR)
          AND f.branchId = s.branchId AND f.roomtypeId = s.roomtypeId
        WHERE f.event = '재실' AND f.isSales = true
          AND f.b_name = '${escapedBranch}'
          AND CAST(f.date AS VARCHAR) >= '${d7Mon.toISOString().split('T')[0]}' AND CAST(f.date AS VARCHAR) <= '${d7Sun.toISOString().split('T')[0]}'
        GROUP BY STRFTIME(CAST(f.date AS DATE) + INTERVAL 7 DAY, '%Y-%m-%d'), f.rt_name
      `),
      duckQuery(`
        SELECT
          STRFTIME(CAST(f.date AS DATE) + INTERVAL 1 DAY, '%Y-%m-%d') as date,
          f.rt_name as room_type,
          SUM(f.oc_rn) as sold,
          MAX(s.activeRooms) as activeRooms
        FROM fact_reservation_event f
        LEFT JOIN staging_stat_daily s
          ON CAST(f.date AS VARCHAR) = CAST(s.date AS VARCHAR)
          AND f.branchId = s.branchId AND f.roomtypeId = s.roomtypeId
        WHERE f.event = '재실' AND f.isSales = true
          AND f.b_name = '${escapedBranch}'
          AND CAST(f.date AS VARCHAR) >= '${d1Mon.toISOString().split('T')[0]}' AND CAST(f.date AS VARCHAR) <= '${d1Sun.toISOString().split('T')[0]}'
        GROUP BY STRFTIME(CAST(f.date AS DATE) + INTERVAL 1 DAY, '%Y-%m-%d'), f.rt_name
      `),
    ])

    // 룸타입 목록
    const roomTypes = [...new Set(occResult.rows.map((r: any) => r.room_type).filter(Boolean))].sort() as string[]

    // D-7, D-1 lookup
    const d7Map: Record<string, number> = {}
    d7Result.rows.forEach((r: any) => {
      const d = String(r.date).split('T')[0].substring(0, 10)
      const occ = r.activeRooms > 0 ? Math.min(Math.round(r.sold / r.activeRooms * 100), 100) : 0
      d7Map[`${d}_${r.room_type}`] = occ
    })
    const d1Map: Record<string, number> = {}
    d1Result.rows.forEach((r: any) => {
      const d = String(r.date).split('T')[0].substring(0, 10)
      const occ = r.activeRooms > 0 ? Math.min(Math.round(r.sold / r.activeRooms * 100), 100) : 0
      d1Map[`${d}_${r.room_type}`] = occ
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

    // 병합
    const mergedData = occResult.rows.map((row: any) => {
      const dateStr = String(row.date).split('T')[0].substring(0, 10)
      const key = `${dateStr}_${row.room_type}`
      const occ = row.activeRooms > 0 ? Math.min(Math.round(row.sold / row.activeRooms * 100), 100) : 0
      const adr = row.paidRn > 0 ? Math.round(row.revenue / row.paidRn) : 0

      const yolo = yoloData?.find((y: any) => y.date === dateStr && y.room_type === row.room_type)
      const guide = guideData?.find((g: any) => g.date === dateStr && g.room_type === row.room_type)

      return {
        date: dateStr,
        room_type: row.room_type,
        occ,
        occ_7d_ago: d7Map[key] ?? null,
        occ_1d_ago: d1Map[key] ?? null,
        adr,
        yolo_price: yolo?.price ? toDisplayPrice(branch!, yolo.price) : null,
        guardrail_price: guide?.min_price || null,
        avg_los: losAverages[key] || 0,
        channel_ratios: channelRatios[key] || {},
      }
    }).filter((r: any) => r.room_type)

    const filteredData = roomType
      ? mergedData.filter((d: any) => d.room_type === roomType)
      : mergedData

    return NextResponse.json({ roomTypes, days: filteredData })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
