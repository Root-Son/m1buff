import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('synced_at')
      .eq('status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('sync-status error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data && data.length > 0) {
      const timestamp = data[0].synced_at
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
