import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 동기화 후 호출: 전지점 topline을 미리 계산하여 cache 테이블에 저장
// Vercel Cron으로 호출 (인증 불필요 — 읽기 전용)
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {

    const year = 2026
    const currentMonth = new Date().getMonth() + 1
    // 현재 월 + 다음 월 캐시 (가장 많이 봄)
    const months = [currentMonth]
    if (currentMonth < 12) months.push(currentMonth + 1)

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    let cached = 0

    for (const month of months) {
      // 전지점(all)만 캐시 — 가장 무거움
      const cacheKey = `topline:all:${year}:${month}`

      const res = await fetch(
        `${baseUrl}/api/topline?branch=all&month=${month}`,
        {
          headers: { 'Cache-Control': 'no-cache' },
          next: { revalidate: 0 }
        }
      )

      if (!res.ok) {
        console.error(`Failed to fetch topline for month ${month}: ${res.status}`)
        continue
      }

      const data = await res.json()

      const { error } = await supabase
        .from('dashboard_cache')
        .upsert({
          cache_key: cacheKey,
          data: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'cache_key' })

      if (error) {
        console.error(`Cache upsert error for ${cacheKey}:`, error)
        continue
      }

      cached++
      console.log(`Cached ${cacheKey}`)
    }

    return NextResponse.json({ success: true, cached, months })
  } catch (error: any) {
    console.error('Cache build error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
