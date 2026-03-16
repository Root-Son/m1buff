import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('synced_at, created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data && data.length > 0) {
      // synced_at이 있으면 사용, 없으면 created_at 사용
      const timestamp = data[0].synced_at || data[0].created_at
      if (!timestamp) {
        return NextResponse.json({ last_synced: null })
      }
      const dt = new Date(timestamp)
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
