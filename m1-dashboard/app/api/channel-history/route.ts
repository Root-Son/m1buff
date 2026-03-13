import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CHANNEL_GROUPS: Record<string, string> = {
  '야놀자(호텔)': 'OTA', '야놀자(모텔)': 'OTA', '아고다': 'OTA',
  '여기어때': 'OTA', '씨트립': 'OTA', '부킹닷컴': 'OTA',
  '익스피디아': 'OTA', '네이버': 'OTA', '트립토파즈': 'OTA',
  '에어비앤비': '에어비앤비',
  '내부채널_어스앱': '자사채널', '내부채널_어스(WEB)': '자사채널', '내부채널_직접예약': '자사채널',
  '내부채널_단체': 'B2B', '내부채널_기업체': 'B2B', '내부채널_홀세일': 'B2B',
  '내부채널_홀세일(선수금)': 'B2B', '내부채널_복지몰': 'B2B', '내부채널_부킹엔진': 'B2B',
  '내부채널_홈쇼핑': '홈쇼핑', '내부채널_OD': 'OD',
  '내부채널_LS': 'LS', 'LS_직계약': 'LS', 'LS_리버스': 'LS', 'LS_제휴부동산': 'LS',
  '내부채널_무료': '무숙', '임직원_무료숙박': '무숙',
  '내부채널_대관': '기타', '내부채널_임시': '기타',
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startYear = parseInt(searchParams.get('startYear') || '2023')
  const endYear = parseInt(searchParams.get('endYear') || '2026')

  try {
    // 연도별 채널 집계
    const yearlyData: Record<number, Record<string, number>> = {}

    for (let year = startYear; year <= endYear; year++) {
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      let allBookings: any[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data: page, error } = await supabase
          .from('raw_booking_history')
          .select('reservation_channel, payment_amount')
          .gte('reservation_created_at', startDate)
          .lte('reservation_created_at', endDate + 'T23:59:59')
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!page || page.length === 0) break
        allBookings = allBookings.concat(page)
        if (page.length < pageSize) break
        from += pageSize
      }

      const groups: Record<string, number> = {}
      let total = 0
      allBookings.forEach((row: any) => {
        const group = CHANNEL_GROUPS[row.reservation_channel] || '기타'
        const amount = row.payment_amount || 0
        groups[group] = (groups[group] || 0) + amount
        total += amount
      })

      // 비율로 변환
      const ratios: Record<string, number> = {}
      Object.entries(groups).forEach(([g, amt]) => {
        ratios[g] = total > 0 ? (amt / total) * 100 : 0
      })
      ratios['_total'] = total
      ratios['_count'] = allBookings.length
      yearlyData[year] = ratios
    }

    return NextResponse.json({ yearlyData })
  } catch (error: any) {
    console.error('Channel History API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
