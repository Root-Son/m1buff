import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error: queryError } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)

    if (queryError) {
      console.error('sync_logs query error:', queryError)
      return NextResponse.json({ error: queryError.message, debug: 'query_failed' }, { status: 500 })
    }

    if (data && data.length > 0) {
      const dt = new Date(data[0].created_at)
      // KST 변환
      const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
      const mm = String(kst.getMonth() + 1).padStart(2, '0')
      const dd = String(kst.getDate()).padStart(2, '0')
      const hh = String(kst.getHours()).padStart(2, '0')
      const min = String(kst.getMinutes()).padStart(2, '0')
      return NextResponse.json({ last_synced: `${mm}-${dd} ${hh}:${min}` })
    }

    return NextResponse.json({ last_synced: null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
