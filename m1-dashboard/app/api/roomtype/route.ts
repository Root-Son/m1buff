import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const weekOffset = parseInt(searchParams.get('weekOffset') || '0')
  const roomType = searchParams.get('roomType') || 'all'

  try {
    // 기준일 (오늘 + weekOffset)
    const today = new Date()
    today.setDate(today.getDate() + (weekOffset * 7))
    
    // 해당 주의 일요일(week end)
    const dayOfWeek = today.getDay()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + (7 - dayOfWeek) % 7)
    
    // 시작일 (일요일 - 6일 = 월요일)
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6)
    
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // OCC 데이터 조회
    let query = supabase
      .from('branch_room_occ')
      .select('date, room_type, occ, occ_1d_ago, occ_7d_ago, delta_1d_pp, adr')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date')
      .order('room_type')

    if (branch !== 'all') {
      query = query.eq('branch_name', branch)
    }

    if (roomType !== 'all') {
      query = query.eq('room_type', roomType)
    }

    const { data, error } = await query

    if (error) throw error

    // YOLO 가격 조회
    let yolo_query = supabase
      .from('yolo_prices')
      .select('date, room_type, price')
      .gte('date', startStr)
      .lte('date', endStr)

    if (branch !== 'all') {
      yolo_query = yolo_query.eq('branch_name', branch)
    }

    if (roomType !== 'all') {
      yolo_query = yolo_query.eq('room_type', roomType)
    }

    const { data: yoloData } = await yolo_query

    // 가드레일 가격 조회
    let guardrail_query = supabase
      .from('price_guide')
      .select('date, room_type, min_price')
      .gte('date', startStr)
      .lte('date', endStr)

    if (branch !== 'all') {
      guardrail_query = guardrail_query.eq('branch_name', branch)
    }

    if (roomType !== 'all') {
      guardrail_query = guardrail_query.eq('room_type', roomType)
    }

    const { data: guardrailData } = await guardrail_query

    // 날짜별로 그룹화
    const dailyData: Record<string, any> = {}
    
    data?.forEach((row) => {
      const date = row.date
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          occ: 0,
          occ_1d_ago: 0,
          occ_7d_ago: 0,
          adr: 0,
          adr_count: 0,
          yolo_price: 0,
          yolo_count: 0,
          guardrail_price: 0,
          guardrail_count: 0,
          count: 0
        }
      }
      
      dailyData[date].occ += (row.occ || 0)
      dailyData[date].occ_1d_ago += (row.occ_1d_ago || 0)
      dailyData[date].occ_7d_ago += (row.occ_7d_ago || 0)
      if (row.adr && row.adr > 0) {
        dailyData[date].adr += row.adr
        dailyData[date].adr_count += 1
      }
      dailyData[date].count += 1
    })

    // YOLO 가격 추가
    yoloData?.forEach((row) => {
      const date = row.date
      if (dailyData[date]) {
        dailyData[date].yolo_price += (row.price || 0)
        dailyData[date].yolo_count += 1
      }
    })

    // 가드레일 가격 추가
    guardrailData?.forEach((row) => {
      const date = row.date
      if (dailyData[date]) {
        dailyData[date].guardrail_price += (row.min_price || 0)
        dailyData[date].guardrail_count += 1
      }
    })

    // 평균 계산
    const days = Object.values(dailyData).map((d: any) => ({
      date: d.date,
      occ: d.count > 0 ? d.occ / d.count : 0,
      occ_1d_ago: d.count > 0 ? d.occ_1d_ago / d.count : 0,
      occ_7d_ago: d.count > 0 ? d.occ_7d_ago / d.count : 0,
      adr: d.adr_count > 0 ? Math.round((d.adr / d.adr_count) / 100) : null,
      yolo_price: d.yolo_count > 0 ? Math.round(d.yolo_price / d.yolo_count) : 0,
      guardrail_price: d.guardrail_count > 0 ? Math.round(d.guardrail_price / d.guardrail_count) : null,
    }))

    return NextResponse.json({
      branch,
      roomType,
      weekOffset,
      startDate: startStr,
      endDate: endStr,
      days,
    })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
