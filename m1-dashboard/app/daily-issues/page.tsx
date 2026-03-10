'use client'

import { useState, useEffect } from 'react'

// ── 요일 변환 헬퍼 ──
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_NAMES[d.getDay()]
}

function formatDateBadge(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`
}

// ── 긴급도 스타일 매핑 ──
const URGENCY_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  critical: { border: 'border-red-600', badge: 'bg-red-600 text-white', label: '긴급' },
  high:     { border: 'border-red-400', badge: 'bg-orange-500 text-white', label: '높음' },
  medium:   { border: 'border-yellow-500', badge: 'bg-yellow-400 text-gray-900', label: '보통' },
  low:      { border: 'border-gray-300', badge: 'bg-gray-400 text-white', label: '낮음' },
}

const ACTION_STYLES: Record<string, { bg: string; label: string }> = {
  down:    { bg: 'bg-red-500 text-white', label: '하향' },
  up:      { bg: 'bg-green-500 text-white', label: '상향' },
  monitor: { bg: 'bg-gray-400 text-white', label: '관찰' },
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

// ── SmartPricingCard ──
function SmartPricingCard({ item }: { item: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const urgency = URGENCY_STYLES[item.urgency] || URGENCY_STYLES.low
  const action = item.action === 'down'
    ? ACTION_STYLES.down
    : item.action === 'up'
    ? ACTION_STYLES.up
    : ACTION_STYLES.monitor

  return (
    <div className={`bg-white rounded-lg border-l-4 ${urgency.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900">{item.branch_name}</span>
          <span className="text-sm text-gray-500">{item.room_type}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            {formatDateBadge(item.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${urgency.badge}`}>
            {urgency.label}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${action.bg}`}>
            {action.label}
          </span>
        </div>
      </div>

      {/* Message */}
      <div className="px-4 pb-3">
        <p className="text-sm font-medium text-gray-800 leading-relaxed">{item.message}</p>
      </div>

      {/* Expandable detail */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1 transition-colors"
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>상세 수치 보기</span>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">잔여/전체</div>
              <div className="font-semibold text-gray-700">{item.available_rooms ?? '-'} / {item.total_rooms ?? '-'}실</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">OCC</div>
              <div className="font-semibold text-gray-700">{item.occ != null ? `${(item.occ * 100).toFixed(1)}%` : '-'}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">리드타임</div>
              <div className="font-semibold text-gray-700">{item.lead_time_days ?? '-'}일</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">판매 페이스</div>
              <div className="font-semibold text-gray-700">{item.sales_pace ?? '-'}</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">셋팅가</div>
              <div className="font-semibold text-gray-700">{item.set_price?.toLocaleString() ?? '-'}원</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">가드레일가</div>
              <div className="font-semibold text-gray-700">{item.guardrail_price?.toLocaleString() ?? '-'}원</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="text-gray-400">가격 차이</div>
              <div className="font-semibold text-gray-700">{item.price_diff_pct != null ? `${item.price_diff_pct > 0 ? '+' : ''}${item.price_diff_pct.toFixed(1)}%` : '-'}</div>
            </div>
            {item.suggested_price != null && (
              <div className="bg-blue-50 rounded p-2">
                <div className="text-blue-400">제안가</div>
                <div className="font-bold text-blue-700">{item.suggested_price.toLocaleString()}원</div>
              </div>
            )}
          </div>
        )}
      </div>
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
  const [showMonitor, setShowMonitor] = useState(false)

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

  const recs = issuesData.smart_recommendations || {}
  const priceDown = recs.price_down || []
  const priceUp = recs.price_up || []
  const monitor = recs.monitor || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">일간 이슈</h1>
          <p className="text-sm text-gray-500 mt-1">
            {issuesData.date} 기준 (vs {issuesData.compared_to})
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

        {/* 2. 가격 하향 권고 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            가격 하향 권고
            <span className="text-sm font-normal text-gray-500">({priceDown.length}건)</span>
          </h2>
          <div className="space-y-3">
            {priceDown.length > 0 ? (
              priceDown.map((item: any, idx: number) => (
                <SmartPricingCard key={idx} item={item} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                가격 하향이 필요한 항목이 없습니다
              </div>
            )}
          </div>
        </section>

        {/* 3. 가격 상향 기회 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
            가격 상향 기회
            <span className="text-sm font-normal text-gray-500">({priceUp.length}건)</span>
          </h2>
          <div className="space-y-3">
            {priceUp.length > 0 ? (
              priceUp.map((item: any, idx: number) => (
                <SmartPricingCard key={idx} item={item} />
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                가격 상향 기회가 없습니다
              </div>
            )}
          </div>
        </section>

        {/* 4. 모니터링 (collapsible, hidden by default) */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
              모니터링
              <span className="text-sm font-normal text-gray-500">({monitor.length}건)</span>
            </h2>
            <button
              onClick={() => setShowMonitor(!showMonitor)}
              className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {showMonitor ? '접기' : '펼치기'}
            </button>
          </div>
          {showMonitor && (
            <div className="space-y-3">
              {monitor.length > 0 ? (
                monitor.map((item: any, idx: number) => (
                  <SmartPricingCard key={idx} item={item} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                  모니터링 항목이 없습니다
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. 이상 징후 */}
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

        {/* 6. Top/Bottom 성과 */}
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
