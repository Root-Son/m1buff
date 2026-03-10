/**
 * 과거 예약 데이터 기반 OCC 빌드업 벤치마크
 * raw_booking_history 테이블에서 자동 생성됨
 *
 * 키: 'branch|roomtype|month|dow_type'
 * 값: { lead_time_days(string): expected_occ (0-1) }
 *   예: { "14": 0.5 } → D-14 시점에 역사적으로 OCC 50% 수준
 */

import benchmarkJson from './pace-benchmark.json'

const PACE_BENCHMARKS: Record<string, Record<string, number>> = benchmarkJson

/**
 * 벤치마크 조회
 * @param leadTimeDays 현재 리드타임 (일)
 * @returns expected OCC (0-1) 또는 null (데이터 없음)
 */
export function getExpectedOcc(
  branchName: string,
  roomType: string,
  month: number,
  dowType: 'weekday' | 'weekend',
  leadTimeDays: number
): number | null {
  const key = `${branchName}|${roomType}|${month}|${dowType}`
  const curve = PACE_BENCHMARKS[key]
  if (!curve) return null

  const ltStr = String(leadTimeDays)

  // 정확한 버킷이 있으면 반환
  if (curve[ltStr] !== undefined) return curve[ltStr]

  // 가장 가까운 버킷에서 보간
  const buckets = Object.keys(curve).map(Number).sort((a, b) => a - b)
  if (buckets.length === 0) return null

  // 범위 밖이면 경계값 반환
  if (leadTimeDays <= buckets[0]) return curve[String(buckets[0])]
  if (leadTimeDays >= buckets[buckets.length - 1]) return curve[String(buckets[buckets.length - 1])]

  // 선형 보간
  for (let i = 0; i < buckets.length - 1; i++) {
    if (leadTimeDays >= buckets[i] && leadTimeDays <= buckets[i + 1]) {
      const ratio = (leadTimeDays - buckets[i]) / (buckets[i + 1] - buckets[i])
      return curve[String(buckets[i])] + ratio * (curve[String(buckets[i + 1])] - curve[String(buckets[i])])
    }
  }

  return null
}
