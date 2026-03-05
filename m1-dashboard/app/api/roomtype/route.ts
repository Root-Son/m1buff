import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

    // 3. 해당 주의 데이터만 가져오기
    const { data, error } = await supabase
      .from('branch_room_occ')
      .select(`
        date,
        room_type,
        occ,
        occ_7d_ago,
        adr
      `)
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
    
    if (error) throw error

    // 4. YOLO 가격 가져오기
    const { data: yoloData } = await supabase
      .from('yolo_prices')
      .select('date, room_type, price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // 5. 가드레일 가져오기
    const { data: guideData } = await supabase
      .from('price_guide')
      .select('date, room_type, min_price')
      .eq('branch_name', branch)
      .gte('date', startDate)
      .lte('date', endDate)

    // 6. 데이터 병합
    const mergedData = (data || []).map(row => {
      const yolo = yoloData?.find(y => 
        y.date === row.date && y.room_type === row.room_type
      )
      const guide = guideData?.find(g => 
        g.date === row.date && g.room_type === row.room_type
      )
      
      return {
        ...row,
        yolo_price: yolo?.price || null,
        guardrail_price: guide?.min_price || null
      }
    })

    // 7. roomType 필터링
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
