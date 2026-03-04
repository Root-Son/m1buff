import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const month = parseInt(searchParams.get('month') || '3')
  const year = 2026

  try {
    // 해당 월의 마지막 날 구하기
    const lastDay = new Date(year, month, 0).getDate()
    const lastDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

    // OCC 데이터 조회
    let occQuery = supabase
      .from('branch_room_occ')
      .select('room_type, occ, adr')
      .eq('date', lastDate)

    if (branch !== 'all') {
      occQuery = occQuery.eq('branch_name', branch)
    }

    const { data: occData } = await occQuery

    // 가드레일 조회
    let guardrailQuery = supabase
      .from('price_guide')
      .select('room_type, min_price')
      .eq('date', lastDate)

    if (branch !== 'all') {
      guardrailQuery = guardrailQuery.eq('branch_name', branch)
    }

    const { data: guardrailData } = await guardrailQuery

    // 셋팅가 조회
    let yoloQuery = supabase
      .from('yolo_prices')
      .select('room_type, price')
      .eq('date', lastDate)

    if (branch !== 'all') {
      yoloQuery = yoloQuery.eq('branch_name', branch)
    }

    const { data: yoloData } = await yoloQuery

    // 룸타입별로 데이터 병합
    const roomTypeMap: Record<string, any> = {}

    occData?.forEach(row => {
      roomTypeMap[row.room_type] = {
        room_type: row.room_type,
        occ: row.occ,
        adr: row.adr,
        guardrail: null,
        yolo: null
      }
    })

    guardrailData?.forEach(row => {
      if (roomTypeMap[row.room_type]) {
        roomTypeMap[row.room_type].guardrail = row.min_price
      } else {
        roomTypeMap[row.room_type] = {
          room_type: row.room_type,
          occ: null,
          adr: null,
          guardrail: row.min_price,
          yolo: null
        }
      }
    })

    yoloData?.forEach(row => {
      if (roomTypeMap[row.room_type]) {
        roomTypeMap[row.room_type].yolo = row.price
      } else {
        roomTypeMap[row.room_type] = {
          room_type: row.room_type,
          occ: null,
          adr: null,
          guardrail: null,
          yolo: row.price
        }
      }
    })

    const roomTypes = Object.values(roomTypeMap)

    return NextResponse.json({
      branch,
      month,
      year,
      last_date: lastDate,
      room_types: roomTypes
    })
  } catch (error: any) {
    console.error('Monthly Summary API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
