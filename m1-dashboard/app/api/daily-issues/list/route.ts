import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data } = await supabase
      .from('daily_issues')
      .select('issue_date')
      .order('issue_date', { ascending: false })
    
    const dates = data?.map(row => row.issue_date) || []
    
    return NextResponse.json(dates)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
