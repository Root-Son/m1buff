'use client'

import { useState, useEffect } from 'react'

// ── 요일 변환 헬퍼 ──
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function formatDateBadge(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`
}

// ── ExecutiveSummaryDashboard ──
function ExecutiveSummaryDashboard({ summary }: { summary: any }) {
  if (!summary) return null

  const stats = [
    { label: '가격 하향 건수', value: summary.price_down_count, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: '가격 상향 건수', value: summary.price_up_count, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    { label: '모니터링 건수', value: summary.monitor_count, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
    { label: '위험 객실수', value: summary.total_rooms_at_risk, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  ]

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">요약 대시보드</h2>
        {summary.critical_count > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-600 text-white animate-pulse">
            긴급 {summary.critical_count}건
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} ${stat.border} border rounded-lg p-4 text-center`}>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {summary.top_urgent_branches && summary.top_urgent_branches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">긴급 지점:</span>
          {summary.top_urgent_branches.map((branch: string) => (
            <span
              key={branch}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
            >
              {branch}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

// ── BranchDailyCard (지점별 1카드 + 일자별 펼침) ──
function BranchDailyCard({ branchName, recommendations, summary }: {
  branchName: string
  recommendations: any[]
  summary: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 일자별 그룹핑
  const byDate: Record<string, any[]> = {}
  const sortedRecs = [...recommendations].sort((a, b) => a.date.localeCompare(b.date))
  sortedRecs.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })

  const priceDownCount = recommendations.filter(r => r.action === 'price_down').length
  const priceUpCount = recommendations.filter(r => r.action === 'price_up').length
  const hasCritical = recommendations.some(r => r.urgency === 'critical')
  const hasHigh = recommendations.some(r => r.urgency === 'high')

  const borderColor = hasCritical ? 'border-red-600' : hasHigh ? 'border-red-400' : priceDownCount > 0 ? 'border-yellow-500' : priceUpCount > 0 ? 'border-green-500' : 'border-gray-300'

  return (
    <div className={`bg-white rounded-lg border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
      {/* 접힌 상태: 지점명 + 뱃지 + 한줄요약 */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{branchName}</span>
            {hasCritical && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white animate-pulse">긴급</span>
            )}
            {priceDownCount > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                하향 {priceDownCount}
              </span>
            )}
            {priceUpCount > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">
                상향 {priceUpCount}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 ml-2 shrink-0">
            {isExpanded ? '▲ 접기' : '▼ 상세'}
          </span>
        </div>
        <div className="text-sm text-gray-600 mt-1">{summary}</div>
      </div>

      {/* 펼친 상태: 일자별 → 룸타입별 상세 */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {Object.entries(byDate).map(([date, dateRecs]) => {
            const leadTime = dateRecs[0]?.lead_time_days ?? 0
            const dateDownCount = dateRecs.filter((r: any) => r.action === 'price_down').length
            const dateUpCount = dateRecs.filter((r: any) => r.action === 'price_up').length

            return (
              <div key={date} className="bg-gray-50 rounded-lg p-3">
                {/* 일자 헤더 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">
                      D+{leadTime}
                    </span>
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                      {formatDateBadge(date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dateDownCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        하향 {dateDownCount}
                      </span>
                    )}
                    {dateUpCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        상향 {dateUpCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* 룸타입별 상세 */}
                <div className="space-y-1.5">
                  {dateRecs.map((rec: any, i: number) => {
                    const actionBg = rec.action === 'price_down'
                      ? 'bg-red-500 text-white'
                      : rec.action === 'price_up'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-700'

                    return (
                      <div key={i} className="bg-white rounded px-3 py-2 border border-gray-100">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{rec.room_type}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionBg}`}>
                            {rec.action === 'price_down' ? '하향' : rec.action === 'price_up' ? '상향' : '관찰'}
                          </span>
                          {(rec.urgency === 'critical' || rec.urgency === 'high') && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                              {rec.urgency === 'critical' ? '긴급' : '높음'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed">
                          잔여 {rec.remaining_rooms ?? 0}실/{rec.total_rooms ?? 0}실 (OCC {rec.occ != null ? `${Math.min(rec.occ * 100, 100).toFixed(0)}%` : '-'})
                          {' | '}
                          {rec.sales_pace_detail || rec.sales_pace || '-'}
                          {rec.set_price != null && (
                            <> | 셋팅가 {rec.set_price.toLocaleString()}원</>
                          )}
                          {rec.guardrail_price != null && rec.price_diff_pct != null && (
                            <> (가드레일 대비 {rec.price_diff_pct >= 0 ? '+' : ''}{rec.price_diff_pct.toFixed(0)}%)</>
                          )}
                        </div>
                        {rec.pace_vs_benchmark === 'ahead' && rec.expected_occ != null && (
                          <div className="text-xs font-medium text-amber-700 mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                            ⚠️ 조기완판위험: 과거 동기간 OCC {(rec.expected_occ * 100).toFixed(0)}% → 현재 {Math.min(rec.occ * 100, 100).toFixed(0)}% (가격 인상 검토)
                          </div>
                        )}
                        {rec.suggested_price != null && (
                          <div className="text-xs font-medium text-blue-700 mt-1">
                            → 제안가: {rec.suggested_price.toLocaleString()}원
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ──
export default function DailyIssuesPage() {
  const [issuesData, setIssuesData] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [newDate, setNewDate] = useState('')

  useEffect(() => {
    fetchAvailableDates()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchIssues(selectedDate)
    }
  }, [selectedDate])

  const fetchAvailableDates = async () => {
    try {
      const response = await fetch('/api/daily-issues/list')
      const dates = await response.json()
      setAvailableDates(dates)

      if (dates.length > 0) {
        setSelectedDate(dates[0])
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch dates:', error)
      setLoading(false)
    }
  }

  const fetchIssues = async (date: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/daily-issues?date=${date}`)
      const data = await response.json()
      setIssuesData(data)
    } catch (error) {
      console.error('Failed to fetch issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateIssuesForDate = async (date: string) => {
    setLoading(true)
    setShowDatePicker(false)
    try {
      const response = await fetch(`/api/daily-issues?date=${date}`)
      const data = await response.json()
      setIssuesData(data)
      setSelectedDate(data.date)
      setAvailableDates(prev => [data.date, ...prev.filter(d => d !== data.date)].sort().reverse())
    } catch (error) {
      console.error('Failed to generate issues:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">분석 중...</div>
      </div>
    )
  }

  if (!issuesData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl mb-4">이슈 데이터가 없습니다</div>
          <div className="space-y-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => newDate && generateIssuesForDate(newDate)}
              disabled={!newDate}
              className="ml-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              생성하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  const byBranch = issuesData.by_branch || {}
  const branchSummaries = issuesData.branch_summaries || {}
  const branchNames = Object.keys(byBranch)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">일간 이슈</h1>
          <p className="text-sm text-gray-500 mt-1">
            {issuesData.date} 기준 | 당일 포함 7일간 분석 (vs {issuesData.compared_to})
          </p>
        </div>
      </header>

      {/* Date Selector */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 overflow-x-auto relative">
            {availableDates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  date === selectedDate
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </button>
            ))}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 whitespace-nowrap"
            >
              + 날짜 선택 생성
            </button>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                <div className="text-sm font-medium text-gray-700 mb-2">생성할 날짜 선택:</div>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  max="2030-12-31"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => newDate && generateIssuesForDate(newDate)}
                    disabled={!newDate}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    생성
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* 1. Executive Summary Dashboard */}
        <ExecutiveSummaryDashboard summary={issuesData.executive_summary} />

        {/* 2. 지점별 이슈 (가나다순, 7일간) */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            지점별 이슈 <span className="text-sm font-normal text-gray-500">({branchNames.length}개 지점, 7일간)</span>
          </h2>
          <div className="space-y-3">
            {branchNames.length > 0 ? (
              branchNames.map((branchName: string) => (
                <BranchDailyCard
                  key={branchName}
                  branchName={branchName}
                  recommendations={byBranch[branchName]}
                  summary={branchSummaries[branchName] || ''}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                분석 데이터가 없습니다
              </div>
            )}
          </div>
        </section>

        {/* 3. 이상 징후 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">이상 징후</h2>
          <div className="space-y-3">
            {issuesData.anomalies && issuesData.anomalies.length > 0 ? (
              issuesData.anomalies.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    item.severity === 'high'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{item.branch}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    오늘: {item.today_pickup?.toLocaleString()}원 | 어제: {item.yesterday_pickup?.toLocaleString()}원
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">
                    {item.message}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                이상 징후가 없습니다
              </div>
            )}
          </div>
        </section>

        {/* 4. Top/Bottom 성과 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">잘한 지점 Top 5</h2>
            <div className="space-y-3">
              {issuesData.top_performers && issuesData.top_performers.map((item: any, idx: number) => (
                <div key={idx} className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        오늘: {item.today_pickup?.toLocaleString()}원
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        +{item.change_pct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">
                        +{item.change_amount?.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">개선 필요 지점 Bottom 5</h2>
            <div className="space-y-3">
              {issuesData.bottom_performers && issuesData.bottom_performers.map((item: any, idx: number) => (
                <div key={idx} className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        오늘: {item.today_pickup?.toLocaleString()}원
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {item.change_pct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.change_amount?.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
