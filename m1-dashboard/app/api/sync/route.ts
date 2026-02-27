import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Google Apps Script에서 호출하는 동기화 API
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== process.env.SYNC_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { table, data } = body

    if (!table || !data) {
      return NextResponse.json(
        { error: 'Missing table or data' },
        { status: 400 }
      )
    }

    let result
    let tableName = ''

    switch (table) {
      case 'raw_bookings':
        tableName = 'raw_bookings'
        // Upsert (reservation_no 기준)
        result = await supabase
          .from(tableName)
          .upsert(data, { onConflict: 'reservation_no' })
        break

      case 'branch_room_occ':
        tableName = 'branch_room_occ'
        // Upsert (date, branch_name, room_type 기준)
        result = await supabase
          .from(tableName)
          .upsert(data)
        break

      case 'price_guide':
        tableName = 'price_guide'
        result = await supabase
          .from(tableName)
          .upsert(data)
        break

      case 'yolo_prices':
        tableName = 'yolo_prices'
        result = await supabase
          .from(tableName)
          .upsert(data)
        break

      case 'targets':
        tableName = 'targets'
        result = await supabase
          .from(tableName)
          .upsert(data)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid table name' },
          { status: 400 }
        )
    }

    if (result.error) {
      // 로그 저장
      await supabase.from('sync_logs').insert({
        table_name: tableName,
        status: 'error',
        error_message: result.error.message,
      })

      throw result.error
    }

    // 성공 로그
    await supabase.from('sync_logs').insert({
      table_name: tableName,
      rows_affected: data.length,
      status: 'success',
    })

    return NextResponse.json({
      success: true,
      table: tableName,
      rows: data.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
