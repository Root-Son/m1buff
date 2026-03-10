/**
 * 스마트 가격 추천 엔진
 * 잔여 객실수 + 리드타임 + 가드레일 대비 셋팅가 + 판매 페이스를 종합하여 가격 방향 제시
 */

import { PricingRecommendation, ExecutiveSummary } from './supabase'
import { getExpectedOcc } from './pace-benchmark-data'

// ===== 임계값 설정 =====
const THRESHOLDS = {
  // 판매 페이스 판정
  FAST_DELTA_1D: 5,    // 일간 +5pp 이상이면 빠름
  FAST_DELTA_7D: 15,   // 주간 +15pp 이상이면 빠름
  SLOW_DELTA_1D: 0,    // 일간 0pp 이하
  SLOW_DELTA_7D: 3,    // 주간 +3pp 이하
  SLOW_LEAD_TIME: 14,  // 리드타임 14일 이내에서만 느림 판정

  // 가격 하향 조건
  DOWN_HIGH_AVAIL_PCT: 0.40,     // 잔여 40% 이상
  DOWN_HIGH_AVAIL_LEAD: 7,      // 리드타임 7일 이하
  DOWN_URGENT_AVAIL_PCT: 0.30,  // 긴급: 잔여 30% 이상
  DOWN_URGENT_LEAD: 3,          // 긴급: 리드타임 3일 이하
  DOWN_PRICE_DIFF_PCT: 30,      // 셋팅가 가드레일 대비 +30% 이상
  DOWN_PRICE_OCC: 0.60,         // OCC 60% 미만
  DOWN_PRICE_LEAD: 14,          // 리드타임 14일 이내

  // 가격 상향 조건
  UP_LOW_AVAIL_PCT: 0.15,       // 잔여 15% 이하 (85%+ 판매)
  UP_LOW_AVAIL_LEAD: 3,         // 리드타임 3일 이상 남아야
  UP_HIGH_OCC: 0.90,            // OCC 90% 이상
  UP_HIGH_OCC_DELTA: 5,         // 일간 +5pp 이상
  UP_HIGH_OCC_LEAD: 5,          // 리드타임 5일 이상

  // 긴급도
  CRITICAL_LEAD: 2,             // 리드타임 2일 이하
  CRITICAL_OCC: 0.50,           // OCC 50% 미만
  HIGH_LEAD: 5,                 // 리드타임 5일 이하
  HIGH_OCC: 0.60,               // OCC 60% 미만
}

// ===== 지점별 룸타입별 보유 객실수 =====
export const ROOM_COUNTS: Record<string, Record<string, number>> = {
  "강남예전로이움점": { "스튜디오": 30, "스튜디오 랜덤": 17, "스튜디오 베리어프리": 1, "패밀리 투룸": 24, "프리미어 스위트": 11 },
  "강남예전시그니티점": { "스튜디오": 8, "패밀리 투룸": 5, "프리미어 스위트 (욕조)": 3, "프리미어 스위트 W": 42, "프리미어 스위트 랜덤": 18, "프리미어 스위트 패밀리": 7 },
  "거북섬점": { "스튜디오": 39, "스튜디오 랜덤": 21, "스튜디오 시티": 36, "스튜디오 트윈": 43, "스튜디오_배리어프리": 2, "프리미어 스위트": 7 },
  "낙산해변": { "스튜디오": 8, "스튜디오 설악": 21, "스튜디오 패밀리": 13, "스튜디오 패밀리 파셜 오션": 17, "프리미어 스위트 오션": 4 },
  "당진터미널점": { "스튜디오": 105, "스튜디오 로프트": 35, "스튜디오 싱글": 4, "스튜디오 트윈": 33 },
  "호텔 동탄": { "스탠다드": 23, "스탠다드 배리어프리": 3, "스탠다드 트윈": 22, "스탠다드(욕조)": 23 },
  "명동점": { "스튜디오": 25, "스튜디오 시티": 24, "스튜디오 테라스": 2, "스튜디오 파노라마": 3 },
  "부산기장점": { "패밀리 쓰리룸": 12, "패밀리 쓰리룸 오션": 7, "패밀리 투룸": 34, "패밀리 투룸 오션": 7 },
  "부산송도해변점": { "스튜디오": 20, "스튜디오 스위트 W 오션": 4, "스튜디오 오션": 51, "스튜디오 트윈": 21, "스튜디오 트윈 오션": 3, "스튜디오 패밀리": 39, "스튜디오 패밀리 오션": 16, "스튜디오_배리어프리": 3, "패밀리 투룸 오션": 1 },
  "부산시청점": { "스튜디오": 14, "스튜디오 W": 8, "스튜디오 랜덤": 23, "스튜디오 비즈니스": 4, "스튜디오 시티": 22 },
  "부산역점": { "패밀리 쓰리룸 G": 7, "패밀리 쓰리룸 G 트리플": 1, "패밀리 쓰리룸 G 파노라마": 2, "패밀리 투룸 G": 4, "프리미어 스위트 G 커넥팅": 14, "프리미어 스위트 W": 11 },
  "부티크남포BIFF점": { "가든 테라스": 1, "스튜디오": 21, "스튜디오 랜덤": 12, "스튜디오 시티": 26, "스튜디오 하버오션": 16 },
  "부티크익선점": { "스튜디오": 16, "스튜디오 시티": 16, "스튜디오 트윈": 8, "스튜디오 파노라마": 6, "패밀리 투룸": 8 },
  "서면점": { "스튜디오": 125, "스튜디오 랜덤": 32, "스튜디오 시티": 45, "스튜디오 싱글": 32, "스튜디오 트윈": 36 },
  "속초등대해변점": { "스튜디오": 117, "스튜디오 W": 20, "스튜디오 랜덤": 68, "스튜디오 시티오션": 3, "스튜디오 패밀리": 13, "스튜디오 풀오션": 32 },
  "속초자이엘라더비치": { "스튜디오": 35, "스튜디오 배리어프리": 3, "스튜디오 와이드 랜덤": 121, "스튜디오 와이드 오션": 39, "스튜디오 와이드(B)": 10, "스튜디오 트윈": 17, "스튜디오 프라이빗 스파": 4, "패밀리 투룸 오션": 4, "패밀리 투룸 파노라마 오션": 3, "프리미어 스위트": 4, "프리미어 스위트 오션": 9 },
  "속초중앙점": { "스튜디오": 49, "스튜디오 랜덤": 36, "스튜디오 배리어프리": 6, "스튜디오 패밀리": 58, "패밀리 로프트 투룸": 1, "패밀리 쓰리룸": 8, "패밀리 와이드 로프트 투룸": 1, "패밀리 와이드 투룸": 10, "패밀리 와이드 투룸 A": 3, "패밀리 투룸": 34, "펜트하우스": 2 },
  "속초해변": { "스튜디오": 11, "스튜디오 오션": 27, "스튜디오 트윈": 26, "스튜디오 파셜오션": 47, "패밀리 투룸": 3, "패밀리 투룸 오션": 8, "프리미어 스위트 오션": 3 },
  "속초해변 AB점": { "스튜디오": 60, "스튜디오 가든": 45, "스튜디오 랜덤": 59, "스튜디오 트윈": 3, "스튜디오 패밀리": 33, "프리미어 스위트": 1 },
  "속초해변C점": { "스튜디오": 25, "스튜디오 파셜 오션": 15, "패밀리 투룸 오션": 7, "프리미어 스위트 오션": 21, "프리미어 스위트 코너": 6 },
  "송도달빛공원점": { "스튜디오": 40, "스튜디오 W": 7, "스튜디오 랜덤": 12, "스튜디오 비즈니스": 34, "스튜디오 시티": 41, "패밀리 투룸": 1, "프리미어 스위트": 9 },
  "스타즈울산점": { "디럭스 패밀리 트윈": 24, "스위트": 5, "스탠다드 더블": 150, "스탠다드 싱글": 34, "스탠다드 트윈": 96, "스탠다드더블_배리어프리": 2, "이그제큐티브 더블": 10, "주니어 스위트": 6 },
  "웨이브파크점": { "스튜디오": 37, "스튜디오 로프트": 41, "스튜디오 로프트 서프": 32, "스튜디오 로프트 트윈": 32, "스튜디오 로프트 파셜 오션": 22, "스튜디오 로프트 패밀리": 40, "패밀리 투룸 오션": 13, "프리미어 스위트 패밀리": 53 },
  "인천차이나타운": { "스튜디오 (B)": 35, "스튜디오 W": 1, "스튜디오 랜덤": 4, "스튜디오 트윈": 44, "스튜디오 하버오션": 20, "스튜디오_배리어프리": 1, "패밀리 쓰리룸": 6, "패밀리 투룸": 14 },
  "제주공항점": { "스튜디오": 42, "스튜디오 W": 9, "스튜디오 싱글": 9, "프리미어 스위트": 7 },
  "해운대역": { "스튜디오": 16, "스튜디오 랜덤": 15, "스튜디오 트윈": 14, "프리미어 스위트": 23, "프리미어 스위트 오션": 6, "프리미어 스위트 트윈": 16, "프리미어 스위트 패밀리": 13, "프리미어 스위트 패밀리 오션": 12 },
  "해운대패러그라프점": { "스튜디오": 16, "스튜디오 W": 5, "스튜디오 랜덤": 6, "스튜디오 패밀리": 9, "패밀리 쓰리룸": 5, "패밀리 투룸": 9 },
}

// ===== 지점명 정규화 =====
export function normalizeBranchName(name: string): string {
  // "호텔 동탄"은 DB 원본 그대로 사용
  if (name === "웨이브파크_펜트") return "웨이브파크점"
  return name
}

// ===== 총 객실수 조회 =====
export function getTotalRooms(branchName: string, roomType: string): number {
  const branch = ROOM_COUNTS[branchName]
  if (!branch) return 0
  return branch[roomType] || 0
}

// ===== 판매 페이스 판정 =====
export function determineSalesPace(
  delta_1d_pp: number,
  delta_7d_pp: number,
  leadTimeDays: number,
  occ?: number
): 'fast' | 'normal' | 'slow' | 'sold_out' {
  // ★ 완판: OCC 98% 이상이면 더 이상 판매 속도를 논할 필요 없음
  if (occ !== undefined && occ >= 0.98) {
    return 'sold_out'
  }

  // 빠름: 일간 +5pp 이상 또는 주간 +15pp 이상
  if (delta_1d_pp >= THRESHOLDS.FAST_DELTA_1D || delta_7d_pp >= THRESHOLDS.FAST_DELTA_7D) {
    return 'fast'
  }

  // 느림: 일간 0pp 이하 AND 주간 +3pp 이하 AND 리드타임 14일 이내
  if (
    delta_1d_pp <= THRESHOLDS.SLOW_DELTA_1D &&
    delta_7d_pp <= THRESHOLDS.SLOW_DELTA_7D &&
    leadTimeDays <= THRESHOLDS.SLOW_LEAD_TIME
  ) {
    return 'slow'
  }

  return 'normal'
}

// ===== 판매 페이스 상세 정보 =====
export function getSalesPaceDetail(
  delta_1d_pp: number,
  delta_7d_pp: number,
  leadTimeDays: number,
  effectiveTotalRooms: number,
  occ?: number
): { pace: 'fast' | 'normal' | 'slow' | 'sold_out'; detail: string } {
  const pace = determineSalesPace(delta_1d_pp, delta_7d_pp, leadTimeDays, occ)

  // ★ 완판이면 별도 메시지
  if (pace === 'sold_out') {
    return { pace, detail: '완판' }
  }

  // 7일간 판매객실 추정: delta_7d_pp(pp) / 100 * total_rooms
  const roomsSold7d = effectiveTotalRooms > 0
    ? Math.max(0, Math.round(effectiveTotalRooms * (delta_7d_pp / 100)))
    : 0

  const paceLabel = pace === 'fast' ? '빠름' : pace === 'slow' ? '느림' : '보통'
  const detail = `${paceLabel} (7일간 판매: ~${roomsSold7d}실, 일간 ${delta_1d_pp >= 0 ? '+' : ''}${delta_1d_pp.toFixed(1)}pp)`

  return { pace, detail }
}

// ===== 요일 유형 판별 =====
function getDowType(dateStr: string): 'weekday' | 'weekend' {
  const d = new Date(dateStr)
  const dow = d.getDay() // 0=Sun, 5=Fri, 6=Sat
  return (dow === 0 || dow === 5 || dow === 6) ? 'weekend' : 'weekday'
}

// ===== 벤치마크 대비 판정 =====
function evaluatePaceVsBenchmark(
  currentOcc: number,
  expectedOcc: number | null,
  leadTimeDays: number
): 'ahead' | 'normal' | 'behind' | null {
  if (expectedOcc === null || expectedOcc <= 0) return null
  if (leadTimeDays <= 1) return null // D-0, D-1은 판정 불필요

  const diff = currentOcc - expectedOcc

  // 현재 OCC가 기대치보다 15pp 이상 높으면 → 조기완판 위험 (ahead)
  if (diff >= 0.15) return 'ahead'

  // 현재 OCC가 기대치보다 15pp 이상 낮으면 → 판매 부진 (behind)
  if (diff <= -0.15) return 'behind'

  return 'normal'
}

// ===== 가격 추천 계산 =====
export function calculatePricingRecommendation(params: {
  branch_name: string
  room_type: string
  date: string
  available_rooms: number
  total_rooms: number
  lead_time_days: number
  set_price: number | null
  guardrail_price: number | null
  occ: number
  occ_1d_ago: number
  occ_7d_ago: number
  delta_1d_pp: number
  delta_7d_pp: number
}): PricingRecommendation {
  const {
    branch_name, room_type, date,
    available_rooms, total_rooms, lead_time_days,
    set_price, guardrail_price,
    occ_1d_ago, occ_7d_ago, delta_1d_pp, delta_7d_pp
  } = params

  // ★ FIX #1: OCC를 100%로 캡핑
  const occ = Math.min(params.occ, 1)

  // total_rooms가 0이면 OCC 데이터에서 fallback
  const effectiveTotalRooms = total_rooms > 0 ? total_rooms : (available_rooms > 0 ? Math.round(available_rooms / Math.max(1 - occ, 0.01)) : 0)

  // ★ 잔여객실 = 미판매 객실 (total × (1 - OCC))
  // available_rooms는 "블락 제외 판매가능 풀"이므로 잔여(미판매)와 다름
  const remaining_rooms = effectiveTotalRooms > 0
    ? Math.max(0, Math.round(effectiveTotalRooms * (1 - occ)))
    : 0

  // 잔여율 (미판매 비율)
  const availPct = effectiveTotalRooms > 0 ? remaining_rooms / effectiveTotalRooms : 0

  // 가격 차이 계산
  let priceDiffPct: number | null = null
  if (set_price && guardrail_price && guardrail_price > 0) {
    priceDiffPct = ((set_price - guardrail_price) / guardrail_price) * 100
  }

  // ★ FIX #2: 판매 페이스 (완판 상태 반영)
  const salesPaceResult = getSalesPaceDetail(delta_1d_pp, delta_7d_pp, lead_time_days, effectiveTotalRooms, occ)
  const salesPace = salesPaceResult.pace
  const salesPaceDetail = salesPaceResult.detail

  // ★ FIX #3: 벤치마크 대비 판정
  const stayMonth = new Date(date).getMonth() + 1
  const dowType = getDowType(date)
  const expectedOcc = getExpectedOcc(branch_name, room_type, stayMonth, dowType, lead_time_days)
  const paceVsBenchmark = evaluatePaceVsBenchmark(occ, expectedOcc, lead_time_days)

  // ===== 가격 방향 결정 =====
  let action: 'price_down' | 'price_up' | 'monitor' = 'monitor'
  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low'
  let suggestedPrice: number | null = null

  // --- 가격 하향 판단 ---
  // 완판 상태에서는 하향 판단 스킵
  const isHighAvailSlowPace = salesPace !== 'sold_out' && availPct >= THRESHOLDS.DOWN_HIGH_AVAIL_PCT && lead_time_days <= THRESHOLDS.DOWN_HIGH_AVAIL_LEAD && salesPace === 'slow'
  const isUrgentHighAvail = salesPace !== 'sold_out' && availPct >= THRESHOLDS.DOWN_URGENT_AVAIL_PCT && lead_time_days <= THRESHOLDS.DOWN_URGENT_LEAD
  const isOverpricedLowOcc = salesPace !== 'sold_out' && priceDiffPct !== null && priceDiffPct >= THRESHOLDS.DOWN_PRICE_DIFF_PCT && occ < THRESHOLDS.DOWN_PRICE_OCC && lead_time_days <= THRESHOLDS.DOWN_PRICE_LEAD

  if (isHighAvailSlowPace || isUrgentHighAvail || isOverpricedLowOcc) {
    action = 'price_down'
    suggestedPrice = guardrail_price

    // 긴급도
    if (lead_time_days <= THRESHOLDS.CRITICAL_LEAD && occ < THRESHOLDS.CRITICAL_OCC) {
      urgency = 'critical'
    } else if (lead_time_days <= THRESHOLDS.HIGH_LEAD && occ < THRESHOLDS.HIGH_OCC) {
      urgency = 'high'
    } else {
      urgency = 'medium'
    }
  }

  // --- 가격 상향 판단 ---
  const isLowAvailFastPace = availPct <= THRESHOLDS.UP_LOW_AVAIL_PCT && salesPace === 'fast' && lead_time_days >= THRESHOLDS.UP_LOW_AVAIL_LEAD
  const isHighOccFastGrowth = occ >= THRESHOLDS.UP_HIGH_OCC && delta_1d_pp >= THRESHOLDS.UP_HIGH_OCC_DELTA && lead_time_days >= THRESHOLDS.UP_HIGH_OCC_LEAD
  const isUnderpriced = set_price !== null && guardrail_price !== null && set_price < guardrail_price && occ >= 0.7
  // ★ NEW: 벤치마크 대비 조기완판 위험 → 가격 인상 시그널
  const isEarlySelloutRisk = paceVsBenchmark === 'ahead' && lead_time_days >= 3 && occ >= 0.6

  if (action !== 'price_down' && (isLowAvailFastPace || isHighOccFastGrowth || isUnderpriced || isEarlySelloutRisk)) {
    action = 'price_up'

    // 조기완판 위험은 urgency를 높임
    if (isEarlySelloutRisk && occ >= 0.8) {
      urgency = 'high'
    } else {
      urgency = 'medium'
    }

    if (set_price && guardrail_price) {
      // 현재가 대비 10~20% 상향 제안
      suggestedPrice = Math.round(set_price * 1.15 / 1000) * 1000
    }
  }

  // 메시지 생성
  const message = generateDetailedMessage({
    remaining_rooms, total_rooms: effectiveTotalRooms,
    lead_time_days, set_price, guardrail_price, priceDiffPct,
    salesPaceDetail, action, suggestedPrice, occ,
    expectedOcc, paceVsBenchmark
  })

  return {
    branch_name, room_type, date,
    remaining_rooms,
    available_rooms, total_rooms: effectiveTotalRooms,
    lead_time_days,
    set_price, guardrail_price,
    price_diff_pct: priceDiffPct,
    occ, occ_1d_ago, occ_7d_ago,
    delta_1d_pp, delta_7d_pp,
    sales_pace: salesPace,
    sales_pace_detail: salesPaceDetail,
    action, urgency,
    message,
    suggested_price: suggestedPrice,
    expected_occ: expectedOcc,
    pace_vs_benchmark: paceVsBenchmark,
  }
}

// ===== 상세 메시지 생성 =====
function generateDetailedMessage(params: {
  remaining_rooms: number
  total_rooms: number
  lead_time_days: number
  set_price: number | null
  guardrail_price: number | null
  priceDiffPct: number | null
  salesPaceDetail: string
  action: 'price_down' | 'price_up' | 'monitor'
  suggestedPrice: number | null
  occ: number
  expectedOcc?: number | null
  paceVsBenchmark?: 'ahead' | 'normal' | 'behind' | null
}): string {
  const {
    remaining_rooms, total_rooms, lead_time_days,
    set_price, guardrail_price, priceDiffPct,
    salesPaceDetail, action, suggestedPrice, occ,
    expectedOcc, paceVsBenchmark
  } = params

  // 가격 비교 텍스트
  let priceText: string
  if (set_price && guardrail_price && priceDiffPct !== null) {
    const sign = priceDiffPct >= 0 ? '+' : ''
    priceText = `셋팅가 ${set_price.toLocaleString()}원 (가드레일 대비 ${sign}${priceDiffPct.toFixed(0)}%)`
  } else if (set_price) {
    priceText = `셋팅가 ${set_price.toLocaleString()}원 (가드레일 미설정)`
  } else if (guardrail_price) {
    priceText = `셋팅가 미등록 (가드레일 ${guardrail_price.toLocaleString()}원)`
  } else {
    priceText = `가격 데이터 없음`
  }

  // 벤치마크 텍스트
  let benchmarkText = ''
  if (paceVsBenchmark === 'ahead' && expectedOcc !== null) {
    benchmarkText = ` | ⚠️ 조기완판위험 (과거 동기간 OCC ${(expectedOcc * 100).toFixed(0)}% → 현재 ${(occ * 100).toFixed(0)}%)`
  } else if (paceVsBenchmark === 'behind' && expectedOcc !== null) {
    benchmarkText = ` | 과거 대비 부진 (과거 ${(expectedOcc * 100).toFixed(0)}% → 현재 ${(occ * 100).toFixed(0)}%)`
  }

  // 액션 텍스트
  let actionText: string
  if (action === 'price_down') {
    if (suggestedPrice) {
      actionText = `가드레일 수준(${suggestedPrice.toLocaleString()}원)까지 하향 검토`
    } else {
      actionText = `가격 하향 검토 필요`
    }
  } else if (action === 'price_up') {
    if (suggestedPrice) {
      actionText = `${suggestedPrice.toLocaleString()}원까지 상향 가능`
    } else {
      actionText = `가격 인상 검토`
    }
  } else {
    actionText = `현 수준 유지, 추이 관찰`
  }

  return `잔여 ${remaining_rooms}실/${total_rooms}실 (OCC ${(occ * 100).toFixed(0)}%) | 리드타임 ${lead_time_days}일 | ${priceText} | ${salesPaceDetail}${benchmarkText} → ${actionText}`
}

// ===== Executive Summary 생성 =====
export function generateExecutiveSummary(recommendations: PricingRecommendation[]): ExecutiveSummary {
  const priceDownItems = recommendations.filter(r => r.action === 'price_down')
  const priceUpItems = recommendations.filter(r => r.action === 'price_up')
  const monitorItems = recommendations.filter(r => r.action === 'monitor')
  const criticalItems = recommendations.filter(r => r.urgency === 'critical')

  // 위험 객실수: 하향 권고 항목의 잔여 객실 합
  const totalRoomsAtRisk = priceDownItems.reduce((sum, r) => sum + r.remaining_rooms, 0)

  // 긴급 지점 (critical + high)
  const urgentBranches = [...new Set(
    recommendations
      .filter(r => r.urgency === 'critical' || r.urgency === 'high')
      .map(r => r.branch_name)
  )].slice(0, 5)

  return {
    total_items: recommendations.length,
    price_down_count: priceDownItems.length,
    price_up_count: priceUpItems.length,
    monitor_count: monitorItems.length,
    critical_count: criticalItems.length,
    total_rooms_at_risk: totalRoomsAtRisk,
    top_urgent_branches: urgentBranches
  }
}

// ===== 지점별 한줄 요약 생성 =====
export function generateBranchSummary(recommendations: PricingRecommendation[]): string {
  if (recommendations.length === 0) return '데이터 없음'

  const avgOcc = recommendations.reduce((s, r) => s + r.occ, 0) / recommendations.length
  const priceDownCount = recommendations.filter(r => r.action === 'price_down').length
  const priceUpCount = recommendations.filter(r => r.action === 'price_up').length
  const hasCritical = recommendations.some(r => r.urgency === 'critical')
  const hasHigh = recommendations.some(r => r.urgency === 'high')

  const earlySelloutCount = recommendations.filter(r => r.pace_vs_benchmark === 'ahead').length

  const parts: string[] = []

  // OCC 상태
  if (avgOcc >= 0.90) {
    parts.push('대부분 완판 근접')
  } else if (avgOcc >= 0.70) {
    parts.push(`평균 OCC ${(avgOcc * 100).toFixed(0)}%로 양호`)
  } else if (avgOcc >= 0.50) {
    parts.push(`평균 OCC ${(avgOcc * 100).toFixed(0)}%`)
  } else {
    parts.push('전반적으로 OCC 낮음')
  }

  // 조기완판 위험 경고
  if (earlySelloutCount > 0) {
    parts.push(`조기완판 위험 ${earlySelloutCount}건 (가격 인상 검토)`)
  }

  // 액션 요약
  if (hasCritical || hasHigh) {
    parts.push('긴급 가격 조정 필요')
  } else if (priceDownCount > 0 && priceUpCount > 0) {
    parts.push(`하향 ${priceDownCount}건, 상향 ${priceUpCount}건 검토`)
  } else if (priceDownCount > 0) {
    parts.push('가드레일과 여유 있기 때문에 낮추는 방안 검토')
  } else if (priceUpCount > 0) {
    parts.push('판매 속도 빠르므로 상향 검토')
  } else {
    parts.push('현재 가격 수준 유지 관찰')
  }

  return parts.join('. ')
}

// ===== 스마트 추천 생성 (일간이슈/주간리뷰 공통) =====
export function generateSmartRecommendations(
  occData: any[],
  yoloPrices: any[],
  priceGuides: any[],
  targetDateStr: string,
  maxLeadDays: number = 30
): {
  executive_summary: ExecutiveSummary
  price_down: PricingRecommendation[]
  price_up: PricingRecommendation[]
  monitor: PricingRecommendation[]
  by_branch: Record<string, PricingRecommendation[]>
  branch_summaries: Record<string, string>
} {
  const today = new Date(targetDateStr)
  const recommendations: PricingRecommendation[] = []

  // 가격 데이터를 key로 인덱싱 (빠른 조회)
  const yoloPriceMap = new Map<string, number>()
  yoloPrices.forEach(yp => {
    const key = `${yp.date}|${normalizeBranchName(yp.branch_name)}|${yp.room_type}`
    yoloPriceMap.set(key, yp.price)
  })

  const priceGuideMap = new Map<string, number>()
  priceGuides.forEach(pg => {
    const key = `${pg.date}|${normalizeBranchName(pg.branch_name)}|${pg.room_type}`
    priceGuideMap.set(key, pg.min_price)
  })

  occData.forEach(row => {
    const branchName = normalizeBranchName(row.branch_name)
    const stayDate = new Date(row.date)
    const leadTimeDays = Math.floor((stayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // 과거 날짜 또는 maxLeadDays 초과는 스킵
    if (leadTimeDays < 0 || leadTimeDays > maxLeadDays) return

    const lookupKey = `${row.date}|${branchName}|${row.room_type}`
    const setPrice = yoloPriceMap.get(lookupKey) || null
    const guardrailPrice = priceGuideMap.get(lookupKey) || null
    const totalRooms = getTotalRooms(branchName, row.room_type)

    const rec = calculatePricingRecommendation({
      branch_name: branchName,
      room_type: row.room_type,
      date: row.date,
      available_rooms: row.available_rooms || 0,
      total_rooms: totalRooms,
      lead_time_days: leadTimeDays,
      set_price: setPrice,
      guardrail_price: guardrailPrice,
      occ: row.occ || 0,
      occ_1d_ago: row.occ_1d_ago || 0,
      occ_7d_ago: row.occ_7d_ago || 0,
      delta_1d_pp: (row.delta_1d_pp || 0) * 100,  // 소수 → pp 변환
      delta_7d_pp: (row.delta_7d_pp || 0) * 100,  // 소수 → pp 변환
    })

    recommendations.push(rec)
  })

  // 정렬: 긴급도 → 리드타임
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = recommendations.sort((a, b) => {
    const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    if (urgDiff !== 0) return urgDiff
    return a.lead_time_days - b.lead_time_days
  })

  // 지점별 그룹핑 (가나다순)
  const byBranch: Record<string, PricingRecommendation[]> = {}
  sorted.forEach(rec => {
    if (!byBranch[rec.branch_name]) {
      byBranch[rec.branch_name] = []
    }
    byBranch[rec.branch_name].push(rec)
  })

  const sortedByBranch: Record<string, PricingRecommendation[]> = {}
  Object.keys(byBranch).sort((a, b) => a.localeCompare(b, 'ko')).forEach(key => {
    sortedByBranch[key] = byBranch[key]
  })

  // 지점별 한줄요약
  const branchSummaries: Record<string, string> = {}
  Object.entries(sortedByBranch).forEach(([branch, recs]) => {
    branchSummaries[branch] = generateBranchSummary(recs)
  })

  return {
    executive_summary: generateExecutiveSummary(sorted),
    price_down: sorted.filter(r => r.action === 'price_down'),
    price_up: sorted.filter(r => r.action === 'price_up'),
    monitor: sorted.filter(r => r.action === 'monitor'),
    by_branch: sortedByBranch,
    branch_summaries: branchSummaries,
  }
}
