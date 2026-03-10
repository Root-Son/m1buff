/**
 * Notion API 클라이언트 + 데일리 리포트 생성
 *
 * 매일 KST 10시에 Vercel Cron이 호출하여
 * 지점별 가격 체크리스트를 Notion 페이지로 자동 생성
 */

import { Client } from '@notionhq/client'
import type { PricingRecommendation, ExecutiveSummary } from './supabase'

// 런타임에만 초기화 (빌드 시 환경변수 없어도 에러 안남)
function getNotionClient() {
  return new Client({ auth: process.env.NOTION_API_KEY })
}

function getParentPageId() {
  return process.env.NOTION_PARENT_PAGE_ID || ''
}

// 요일 한글
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const dayName = DAY_NAMES[d.getDay()]
  return `${month}/${day}(${dayName})`
}

function getActionEmoji(action: string, paceVsBenchmark?: string | null): string {
  if (action === 'guardrail_adjust') return '🟠'
  if (action === 'price_down') return '🔴'
  if (action === 'price_up' && paceVsBenchmark === 'ahead') return '🟡'
  if (action === 'price_up') return '🟢'
  return '⚪'
}

// ===== 메인: 데일리 리포트 생성 =====
export async function createDailyReport(
  dateStr: string,
  executiveSummary: ExecutiveSummary,
  byBranch: Record<string, PricingRecommendation[]>,
  branchSummaries: Record<string, string>
): Promise<{ parentPageId: string; branchPageIds: string[] }> {
  const d = new Date(dateStr)
  const dayName = DAY_NAMES[d.getDay()]
  const title = `${dateStr} (${dayName}) 데일리 리포트`

  const notion = getNotionClient()

  // 1. 날짜별 상위 페이지 생성
  const parentPage = await notion.pages.create({
    parent: { page_id: getParentPageId() },
    icon: { type: 'emoji', emoji: '📊' } as any,
    properties: {
      title: {
        title: [{ text: { content: title } }]
      }
    },
    children: buildSummaryBlocks(dateStr, executiveSummary, byBranch) as any
  })

  const parentPageId = parentPage.id

  // 2. 지점별 하위 페이지 생성 (가나다순)
  const branchNames = Object.keys(byBranch).sort((a, b) => a.localeCompare(b, 'ko'))
  const branchPageIds: string[] = []

  for (const branch of branchNames) {
    const recs = byBranch[branch]
    const summary = branchSummaries[branch] || ''

    try {
      const branchPage = await createBranchChecklist(parentPageId, branch, summary, recs, dateStr)
      branchPageIds.push(branchPage.id)
    } catch (err) {
      console.error(`Notion: ${branch} 페이지 생성 실패:`, err)
    }
  }

  return { parentPageId, branchPageIds }
}

// ===== 상위 페이지 요약 블록 =====
function buildSummaryBlocks(
  dateStr: string,
  summary: ExecutiveSummary,
  byBranch: Record<string, PricingRecommendation[]>
): any[] {
  const blocks: any[] = []

  // 요약 캘아웃
  blocks.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '📋' },
      rich_text: [{
        text: {
          content: `하향 ${summary.price_down_count}건 | 상향 ${summary.price_up_count}건 | 모니터링 ${summary.monitor_count}건 | 긴급 ${summary.critical_count}건`
        }
      }]
    }
  })

  // 긴급 지점 (있으면)
  if (summary.top_urgent_branches.length > 0) {
    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '🚨' },
        rich_text: [{
          text: {
            content: `긴급: ${summary.top_urgent_branches.join(', ')}`
          }
        }],
        color: 'red_background'
      }
    })
  }

  // 구분선
  blocks.push({ object: 'block', type: 'divider', divider: {} })

  // 지점 목록 (하위 페이지로 자동 생성되므로 안내만)
  const branchCount = Object.keys(byBranch).length
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        text: { content: `아래 ${branchCount}개 지점별 체크리스트를 확인하세요 👇` },
        annotations: { color: 'gray' }
      }]
    }
  })

  return blocks
}

// ===== 지점별 하위 체크리스트 페이지 =====
async function createBranchChecklist(
  parentPageId: string,
  branchName: string,
  summary: string,
  recs: PricingRecommendation[],
  baseDate: string
): Promise<any> {
  // 지점별 액션 수 카운트
  const downCount = recs.filter(r => r.action === 'price_down').length
  const upCount = recs.filter(r => r.action === 'price_up').length

  // 아이콘 결정
  let emoji: string = '✅'
  if (recs.some(r => r.urgency === 'critical')) emoji = '🚨'
  else if (downCount > 0) emoji = '📉'
  else if (upCount > 0) emoji = '📈'

  // 블록 구성
  const children: any[] = []

  // 한줄 요약
  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { type: 'emoji', emoji: '💡' },
      rich_text: [{
        text: { content: summary }
      }]
    }
  })

  // D+N 별 그룹핑
  const byLeadDay = groupByLeadDay(recs, baseDate)
  const leadDays = Object.keys(byLeadDay).map(Number).sort((a, b) => a - b)

  for (const leadDay of leadDays) {
    const dayRecs = byLeadDay[leadDay]
    const stayDate = new Date(baseDate)
    stayDate.setDate(stayDate.getDate() + leadDay)
    const dateLabel = formatDateKR(stayDate.toISOString().split('T')[0])

    // D+N 헤딩
    children.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{
          text: { content: `D+${leadDay} ${dateLabel}` },
          annotations: { bold: true }
        }]
      }
    })

    // 각 룸타입별 체크리스트
    for (const rec of dayRecs) {
      const emoji = getActionEmoji(rec.action, rec.pace_vs_benchmark)
      const checklistText = buildChecklistText(rec, emoji)

      children.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          checked: false,
          rich_text: parseChecklistRichText(checklistText, rec)
        }
      })
    }
  }

  // Notion API: 하위 페이지 생성 (최대 100 블록 제한)
  // 100개 초과 시 분할
  const maxBlocksPerRequest = 100
  const firstBatch = children.slice(0, maxBlocksPerRequest)
  const remainingBatches = children.slice(maxBlocksPerRequest)

  const notion = getNotionClient()

  const page = await notion.pages.create({
    parent: { page_id: parentPageId },
    icon: { type: 'emoji', emoji } as any,
    properties: {
      title: {
        title: [{ text: { content: `${branchName} (하향 ${downCount} / 상향 ${upCount})` } }]
      }
    },
    children: firstBatch as any
  })

  // 남은 블록 추가
  if (remainingBatches.length > 0) {
    for (let i = 0; i < remainingBatches.length; i += maxBlocksPerRequest) {
      const batch = remainingBatches.slice(i, i + maxBlocksPerRequest)
      await notion.blocks.children.append({
        block_id: page.id,
        children: batch as any
      })
    }
  }

  return page
}

// ===== D+N 그룹핑 =====
function groupByLeadDay(
  recs: PricingRecommendation[],
  baseDate: string
): Record<number, PricingRecommendation[]> {
  const result: Record<number, PricingRecommendation[]> = {}
  const base = new Date(baseDate)

  recs.forEach(rec => {
    const stayDate = new Date(rec.date)
    const leadDay = Math.round((stayDate.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))

    if (!result[leadDay]) result[leadDay] = []
    result[leadDay].push(rec)
  })

  return result
}

// ===== 체크리스트 텍스트 생성 =====
function buildChecklistText(rec: PricingRecommendation, emoji: string): string {
  const occPct = (rec.occ * 100).toFixed(0)

  // 잔여객실 정보
  const remainInfo = `잔여 ${rec.remaining_rooms}/${rec.total_rooms}실(OCC ${occPct}%)`

  // 가격 정보
  let priceInfo = ''
  if (rec.set_price && rec.guardrail_price && rec.price_diff_pct !== null) {
    const sign = rec.price_diff_pct >= 0 ? '+' : ''
    priceInfo = `셋팅가 ${rec.set_price.toLocaleString()}원(가드레일${sign}${rec.price_diff_pct.toFixed(0)}%)`
  } else if (rec.set_price) {
    priceInfo = `셋팅가 ${rec.set_price.toLocaleString()}원`
  }

  // 페이스 정보
  const paceInfo = rec.sales_pace_detail

  // 벤치마크 정보
  let benchmarkInfo = ''
  if (rec.pace_vs_benchmark === 'ahead' && rec.expected_occ != null) {
    const finalPart = rec.expected_final_occ != null ? `→최종${(rec.expected_final_occ * 100).toFixed(0)}%` : ''
    benchmarkInfo = ` | ⚠️ 조기완판위험(과거D-${rec.lead_time_days} ${(rec.expected_occ * 100).toFixed(0)}%${finalPart}, 현재${occPct}%)`
  }

  // 액션
  let actionText = ''
  if (rec.action === 'guardrail_adjust') {
    actionText = `→ 이미 가드레일 이하, 가드레일 조정 필요`
  } else if (rec.action === 'price_down') {
    if (rec.suggested_price) {
      actionText = `→ 가드레일(${rec.suggested_price.toLocaleString()}원)까지 하향`
    } else {
      actionText = `→ 가격 하향 검토`
    }
  } else if (rec.action === 'price_up') {
    if (rec.suggested_price) {
      actionText = `→ ${rec.suggested_price.toLocaleString()}원까지 상향 가능`
    } else {
      actionText = `→ 가격 상향 검토`
    }
  } else {
    actionText = `→ 현 수준 유지`
  }

  return `${emoji} ${rec.room_type}: ${remainInfo} | ${priceInfo ? priceInfo + ' | ' : ''}${paceInfo}${benchmarkInfo} ${actionText}`
}

// ===== 체크리스트 Rich Text (색상 적용) =====
function parseChecklistRichText(text: string, rec: PricingRecommendation): any[] {
  // 긴급도에 따라 색상 적용
  let color: string = 'default'
  if (rec.urgency === 'critical') color = 'red'
  else if (rec.urgency === 'high') color = 'orange'
  else if (rec.action === 'price_up') color = 'green'

  return [{
    text: { content: text },
    annotations: {
      bold: rec.urgency === 'critical' || rec.urgency === 'high',
      color
    }
  }]
}

// ===== 기존 리포트 삭제 (중복 방지) =====
export async function deleteExistingReport(dateStr: string): Promise<void> {
  try {
    const notion = getNotionClient()

    // 부모 페이지의 자식 블록(하위 페이지) 검색
    const children = await notion.blocks.children.list({
      block_id: getParentPageId(),
      page_size: 100
    })

    for (const block of children.results) {
      const b = block as any
      if (b.type === 'child_page') {
        const title = b.child_page?.title || ''
        if (title.startsWith(dateStr)) {
          // 해당 날짜 리포트 삭제 (아카이브)
          await notion.blocks.delete({ block_id: block.id })
          console.log(`Notion: 기존 리포트 삭제됨 - ${title}`)
        }
      }
    }
  } catch (err) {
    console.error('Notion: 기존 리포트 삭제 실패:', err)
  }
}
