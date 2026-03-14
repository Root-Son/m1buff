import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error: queryError } = await supabase
      .from('sync_logs')
      .select('*')
      .limit(1)

    if (queryError) {
      console.error('sync_logs query error:', queryError)
      return NextResponse.json({ error: queryError.message, debug: 'query_failed' }, { status: 500 })
    }

    if (data && data.length > 0) {
      // 컬럼 확인용 - 임시
      return NextResponse.json({ columns: Object.keys(data[0]), row: data[0] })
    }

    return NextResponse.json({ last_synced: null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
