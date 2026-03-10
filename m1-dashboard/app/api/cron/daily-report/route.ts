/**
 * Vercel Cron Job: 데일리 리포트 → Notion 자동 생성
 *
 * 스케줄: 매일 UTC 01:00 (KST 10:00)
 * 로직:
 *   1. CRON_SECRET 인증
 *   2. 오늘 날짜(KST) 기준 데이터 조회
 *   3. generateSmartRecommendations()로 분석
 *   4. Notion API로 지점별 체크리스트 페이지 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateSmartRecommendations } from '@/lib/pricing-engine'
import { createDailyReport, deleteExistingReport } from '@/lib/notion'

export const maxDuration = 60  // Vercel function timeout 60초

export async function GET(request: NextRequest) {
  try {
    // 1. 인증 (Vercel Cron은 Authorization 헤더로 CRON_SECRET 전송)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // 수동 호출 시 ?secret= 쿼리도 허용
    const querySecret = request.nextUrl.searchParams.get('secret')

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 오늘 날짜 (KST 기준)
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(now.getTime() + kstOffset)
    const todayStr = kstNow.toISOString().split('T')[0]

    // 수동 테스트: ?date=2026-03-10 으로 날짜 지정 가능
    const requestedDate = request.nextUrl.searchParams.get('date')
    const targetDateStr = requestedDate || todayStr

    console.log(`[Cron] 데일리 리포트 생성 시작: ${targetDateStr}`)

    // 3. 데이터 조회 (daily-issues/route.ts 패턴 재사용)
    // OCC 데이터: 오늘 + 6일 = 7일간
    const sevenDaysLater = new Date(targetDateStr)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 6)
    const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]

    const [occResult, yoloResult, guideResult] = await Promise.all([
      fetchAllRows('branch_room_occ', targetDateStr, sevenDaysStr),
      fetchAllRows('yolo_prices', targetDateStr, sevenDaysStr),
      fetchAllRows('price_guide', targetDateStr, sevenDaysStr),
    ])

    console.log(`[Cron] 데이터 조회 완료: OCC ${occResult.length}행, 가격 ${yoloResult.length}행, 가드레일 ${guideResult.length}행`)

    if (occResult.length === 0) {
      return NextResponse.json({
        status: 'skipped',
        message: `${targetDateStr} OCC 데이터 없음`,
        date: targetDateStr
      })
    }

    // 4. 스마트 추천 생성
    const smartRecs = generateSmartRecommendations(
      occResult,
      yoloResult,
      guideResult,
      targetDateStr,
      6  // 당일 + 6일 = 7일
    )

    console.log(`[Cron] 분석 완료: ${Object.keys(smartRecs.by_branch).length}개 지점, 하향 ${smartRecs.executive_summary.price_down_count}건`)

    // 5. Notion 환경변수 확인
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_PARENT_PAGE_ID) {
      return NextResponse.json({
        status: 'error',
        message: 'NOTION_API_KEY 또는 NOTION_PARENT_PAGE_ID 환경변수가 설정되지 않았습니다.',
        data: {
          date: targetDateStr,
          branches: Object.keys(smartRecs.by_branch).length,
          total_items: smartRecs.executive_summary.total_items,
          price_down: smartRecs.executive_summary.price_down_count,
          price_up: smartRecs.executive_summary.price_up_count,
        }
      }, { status: 500 })
    }

    // 6. 기존 리포트 삭제 (중복 방지)
    await deleteExistingReport(targetDateStr)

    // 7. Notion 페이지 생성
    const result = await createDailyReport(
      targetDateStr,
      smartRecs.executive_summary,
      smartRecs.by_branch,
      smartRecs.branch_summaries
    )

    console.log(`[Cron] Notion 리포트 생성 완료: ${result.branchPageIds.length}개 지점`)

    return NextResponse.json({
      status: 'success',
      date: targetDateStr,
      notion_parent_page: result.parentPageId,
      branches_created: result.branchPageIds.length,
      summary: {
        total_items: smartRecs.executive_summary.total_items,
        price_down: smartRecs.executive_summary.price_down_count,
        price_up: smartRecs.executive_summary.price_up_count,
        monitor: smartRecs.executive_summary.monitor_count,
        critical: smartRecs.executive_summary.critical_count,
      }
    })

  } catch (error: any) {
    console.error('[Cron] 데일리 리포트 에러:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}

// ===== Supabase 페이지네이션 헬퍼 (1000행 제한 우회) =====
async function fetchAllRows(
  table: string,
  dateFrom: string,
  dateTo: string
): Promise<any[]> {
  const allRows: any[] = []
  const pageSize = 1000
  let page = 0

  while (true) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .range(from, to)

    if (error) {
      console.error(`[Cron] ${table} 조회 에러:`, error)
      break
    }

    if (!data || data.length === 0) break

    allRows.push(...data)

    if (data.length < pageSize) break
    page++
  }

  return allRows
}
