import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch')

  if (!branch || branch === '전지점') {
    return NextResponse.json({ error: 'Branch required' }, { status: 400 })
  }

  try {
    // 1. 해당 지점의 실제 룸타입 목록 가져오기
    const { data: roomTypesData, error: roomTypesError } = await supabase
      .from('branch_room_occ')
      .select('room_type')
      .eq('branch_name', branch)
    
    if (roomTypesError) throw roomTypesError

    // 중복 제거 및 정렬
    const roomTypes = [...new Set(roomTypesData?.map(d => d.room_type) || [])].sort()

    // 2. 룸타입별 성과 데이터
    const { data, error } = await supabase.rpc('get_roomtype_performance', {
      p_branch_name: branch
    })

    if (error) throw error

    return NextResponse.json({
      roomTypes,  // 실제 DB에서 가져온 룸타입 목록
      days: data || []
    })
  } catch (error: any) {
    console.error('Roomtype API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
