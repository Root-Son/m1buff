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
      .select('date, room_type, occ, occ_1d_ago, occ_7d_ago, delta_1d_pp')
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
          count: 0
        }
      }
      
      dailyData[date].occ += (row.occ || 0)
      dailyData[date].occ_1d_ago += (row.occ_1d_ago || 0)
      dailyData[date].occ_7d_ago += (row.occ_7d_ago || 0)
      dailyData[date].count += 1
    })

    // 평균 계산
    const days = Object.values(dailyData).map((d: any) => ({
      date: d.date,
      occ: d.count > 0 ? d.occ / d.count : 0,
      occ_1d_ago: d.count > 0 ? d.occ_1d_ago / d.count : 0,
      occ_7d_ago: d.count > 0 ? d.occ_7d_ago / d.count : 0,
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
