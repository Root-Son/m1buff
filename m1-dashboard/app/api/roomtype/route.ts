import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 채널 그룹 맵핑
const CHANNEL_GROUPS: Record<string, string> = {
  '야놀자(호텔)': 'OTA',
  '야놀자(모텔)': 'OTA',
  '아고다': 'OTA',
  '여기어때': 'OTA',
  '씨트립': 'OTA',
  '부킹닷컴': 'OTA',
  '익스피디아': 'OTA',
  '네이버': 'OTA',
  '트립토파즈': 'OTA',
  '에어비앤비': '에어비앤비',
  '내부채널_어스앱': '자사채널',
  '내부채널_어스(WEB)': '자사채널',
  '내부채널_직접예약': '자사채널',
  '내부채널_단체': 'B2B',
  '내부채널_기업체': 'B2B',
  '내부채널_홀세일': 'B2B',
  '내부채널_홀세일(선수금)': 'B2B',
  '내부채널_복지몰': 'B2B',
  '내부채널_부킹엔진': 'B2B',
  '내부채널_홈쇼핑': '홈쇼핑',
  '내부채널_OD': 'OD',
  '내부채널_LS': 'LS',
  'LS_직계약': 'LS',
  'LS_리버스': 'LS',
  'LS_제휴부동산': 'LS',
  '내부채널_무료': '무숙',
  '임직원_무료숙박': '무숙',
  '내부채널_대관': '기타',
  '내부채널_임시': '기타',
}

function getChannelGroup(channel: string): string {
  return CHANNEL_GROUPS[channel] || '기타'
}

// ISO Week 계산
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
    // 1. 해당 지점의 실제 룸타입 목록
    const { data: roomTypesData, error: roomTypesError } = await supabase
      .from('branch_room_occ')
      .select('room_type')
      .eq('branch_name', branch)
    
    if (roomTypesError) throw roomTypesError

    const roomTypes = [...new Set(roomTypesData?.map(d => d.room_type) || [])].sort()

    // 2. 주차 범위 계산
    const { monday, sunday } = getWeekRange(weekOffset)
    const startDate = monday.toISOString().split('T')[0]
    const endDate = sunday.toISOString().split('T')[0]

    // 3. 해당 주의 OCC/ADR 데이터
    const { data, error } = await supabase
      .from('branch_room_occ')
      .select(`
        date,
        room_type,
        occ,
        occ_1d_ago,
        occ_7d_ago,
        adr
      `)
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
    
    if (error) throw error

    // 4. LoS 데이터 (평균 숙박일수)
    const { data: losData, error: losError } = await supabase
      .from('raw_bookings')
      .select('check_in_date, roomtype, nights')
      .eq('branch_name', branch)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)

    // 5. 채널별 예약 데이터
    const { data: channelData, error: channelError } = await supabase
      .from('raw_bookings')
      .select('check_in_date, roomtype, reservation_channel')
      .eq('branch_name', branch)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)

    // 6. YOLO 가격 가져오기
    const { data: yoloData } = await supabase
      .from('yolo_prices')
      .select('date, room_type, price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // 7. 가드레일 가져오기
    const { data: guideData } = await supabase
      .from('price_guide')
      .select('date, room_type, min_price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // 8. LoS 집계 (date별, 룸타입별 평균)
    // branch_room_occ의 date = 체크인 날짜
    // raw_bookings의 check_in_date와 매칭
    const losMap: Record<string, Record<string, number>> = {}
    losData?.forEach(row => {
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
    
    console.log('LoS Map sample:', Object.entries(losAverages).slice(0, 3))

    // 9. 채널별 비중 집계 (date별, 룸타입별)
    const channelMap: Record<string, Record<string, number>> = {}
    channelData?.forEach(row => {
      const dateStr = String(row.check_in_date).split('T')[0].split(' ')[0]
      const key = `${dateStr}_${row.roomtype}`
      const group = getChannelGroup(row.reservation_channel || '')
      
      if (!channelMap[key]) channelMap[key] = {}
      channelMap[key][group] = (channelMap[key][group] || 0) + 1
    })

    // 채널 비중 계산 (퍼센트)
    const channelRatios: Record<string, Record<string, number>> = {}
    Object.entries(channelMap).forEach(([key, groups]) => {
      const total = Object.values(groups).reduce((sum, cnt) => sum + cnt, 0)
      channelRatios[key] = {}
      Object.entries(groups).forEach(([group, count]) => {
        channelRatios[key][group] = total > 0 ? (count / total) * 100 : 0
      })
    })

    // 10. 데이터 병합
    
    const mergedData = (data || []).map(row => {
      const yolo = yoloData?.find(y => 
        y.date === row.date && y.room_type === row.room_type
      )
      const guide = guideData?.find(g => 
        g.date === row.date && g.room_type === row.room_type
      )
      
      const key = `${row.date}_${row.room_type}`
      
      const result = {
        ...row,
        yolo_price: yolo?.price || null,
        guardrail_price: guide?.min_price || null,
        avg_los: losAverages[key] || 0,
        channel_ratios: channelRatios[key] || {}
      }
      
      if (losAverages[key]) {
        console.log(`Matched LoS for ${key}: ${losAverages[key].toFixed(2)}`)
      }
      if (channelRatios[key] && Object.keys(channelRatios[key]).length > 0) {
        console.log(`Matched channels for ${key}:`, channelRatios[key])
      }
      
      return result
    })

    // 11. roomType 필터링
    const filteredData = roomType 
      ? mergedData.filter(d => d.room_type === roomType)
      : mergedData

    return NextResponse.json({
      roomTypes,
      days: filteredData
    })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
