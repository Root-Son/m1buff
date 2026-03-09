export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .select('week_start, week_end')
      .order('week_start', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Weekly Reviews List Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
