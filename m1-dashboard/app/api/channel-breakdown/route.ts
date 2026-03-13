import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CHANNEL_GROUPS: Record<string, string> = {
  '야놀자(호텔)': 'OTA',
  '야놀자(모텔)': 'OTA',
  '아고다': 'OTA',
  '여기어때': 'OTA',
  '씨트립': 'OTA',
  '부킹닷컴': 'OTA',
  '익스피디아': 'OTA',
  '네이버': 'OTA',
  '트립토파즈': 'OTA',
  '에어비앤비': '에어비앤비',
  '내부채널_어스앱': '자사채널',
  '내부채널_어스(WEB)': '자사채널',
  '내부채널_직접예약': '자사채널',
  '내부채널_단체': 'B2B',
  '내부채널_기업체': 'B2B',
  '내부채널_홀세일': 'B2B',
  '내부채널_홀세일(선수금)': 'B2B',
  '내부채널_복지몰': 'B2B',
  '내부채널_부킹엔진': 'B2B',
  '내부채널_홈쇼핑': '홈쇼핑',
  '내부채널_OD': 'OD',
  '내부채널_LS': 'LS',
  'LS_직계약': 'LS',
  'LS_리버스': 'LS',
  'LS_제휴부동산': 'LS',
  '내부채널_무료': '무숙',
  '임직원_무료숙박': '무숙',
  '내부채널_대관': '기타',
  '내부채널_임시': '기타',
}

const CHANNEL_COLORS: Record<string, string> = {
  'OTA': '#3B82F6',
  '자사채널': '#10B981',
  'B2B': '#F59E0B',
  '에어비앤비': '#EC4899',
  'LS': '#8B5CF6',
  'OD': '#6366F1',
  '홈쇼핑': '#14B8A6',
  '무숙': '#9CA3AF',
  '기타': '#D1D5DB',
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 })
  }

  try {
    // 페이지네이션으로 전체 조회
    let allBookings: any[] = []
    let from = 0
    const pageSize = 1000

    while (true) {
      let query = supabase
        .from('raw_bookings')
        .select('reservation_created_at, reservation_channel, payment_amount, nights')
        .gte('reservation_created_at', startDate)
        .lte('reservation_created_at', endDate + 'T23:59:59')
        .range(from, from + pageSize - 1)

      if (branch !== 'all') {
        query = query.eq('branch_name', branch)
      }

      const { data: page, error } = await query
      if (error) throw error
      if (!page || page.length === 0) break
      allBookings = allBookings.concat(page)
      if (page.length < pageSize) break
      from += pageSize
    }

    // 채널 그룹별 매출 집계
    const groupTotals: Record<string, number> = {}
    let totalAmount = 0

    allBookings.forEach((row: any) => {
      const group = CHANNEL_GROUPS[row.reservation_channel] || '기타'
      const amount = row.payment_amount || 0
      groupTotals[group] = (groupTotals[group] || 0) + amount
      totalAmount += amount
    })

    // 일별 채널 그룹 집계 (매출 + 건수 + 총박수)
    const dailyMap: Record<string, Record<string, { amount: number; count: number; totalNights: number }>> = {}
    allBookings.forEach((row: any) => {
      const dateStr = String(row.reservation_created_at).split('T')[0].split(' ')[0]
      const group = CHANNEL_GROUPS[row.reservation_channel] || '기타'
      const amount = row.payment_amount || 0
      const nights = row.nights || 1
      if (!dailyMap[dateStr]) dailyMap[dateStr] = {}
      if (!dailyMap[dateStr][group]) dailyMap[dateStr][group] = { amount: 0, count: 0, totalNights: 0 }
      dailyMap[dateStr][group].amount += amount
      dailyMap[dateStr][group].count += 1
      dailyMap[dateStr][group].totalNights += nights
    })

    // 정렬 (매출 높은 순)
    const channels = Object.entries(groupTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([group, amount]) => ({
        channel: group,
        amount,
        ratio: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        color: CHANNEL_COLORS[group] || '#D1D5DB',
      }))

    // 일별 데이터
    const days = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, groups]) => {
        const dayTotal = Object.values(groups).reduce((s, v) => s + v.amount, 0)
        return {
          date,
          total: dayTotal,
          channels: Object.entries(groups)
            .sort((a, b) => b[1].amount - a[1].amount)
            .map(([group, { amount, count, totalNights }]) => ({
              channel: group,
              amount,
              count,
              adr: totalNights > 0 ? Math.round(amount / totalNights) : 0,
              ratio: dayTotal > 0 ? (amount / dayTotal) * 100 : 0,
              color: CHANNEL_COLORS[group] || '#D1D5DB',
            }))
        }
      })

    return NextResponse.json({
      branch,
      startDate,
      endDate,
      totalAmount,
      totalBookings: allBookings.length,
      channels,
      days,
    })
  } catch (error: any) {
    console.error('Channel Breakdown API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
