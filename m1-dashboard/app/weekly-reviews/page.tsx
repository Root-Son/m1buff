'use client'

import { useState, useEffect } from 'react'

// 주차 레이블 생성 함수
function getWeekLabel(weekStart: string) {
  const start = new Date(weekStart)
  const month = start.getMonth() + 1

  // 해당 월의 첫 월요일 찾기
  const firstDay = new Date(start.getFullYear(), start.getMonth(), 1)
  let firstMonday = new Date(firstDay)

  const dayOfWeek = firstDay.getDay()
  if (dayOfWeek === 0) {
    firstMonday.setDate(2)
  } else if (dayOfWeek !== 1) {
    firstMonday.setDate(1 + (8 - dayOfWeek))
  }

  if (start < firstMonday) {
    const prevMonth = start.getMonth()
    const prevMonthFirstDay = new Date(start.getFullYear(), prevMonth, 1)
    let prevFirstMonday = new Date(prevMonthFirstDay)
    const prevDayOfWeek = prevMonthFirstDay.getDay()
    if (prevDayOfWeek === 0) {
      prevFirstMonday.setDate(2)
    } else if (prevDayOfWeek !== 1) {
      prevFirstMonday.setDate(1 + (8 - prevDayOfWeek))
    }

    const weekNumber = Math.floor((start.getTime() - prevFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    return `${prevMonth}월 ${weekNumber}주`
  }

  let weekNumber = Math.floor((start.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  // 5주차 이상이면 다음달 1주차
  if (weekNumber >= 5) {
    const nextMonth = start.getMonth() + 2 > 12 ? 1 : start.getMonth() + 2
    return `${nextMonth}월 ${weekNumber - 4}주`
  }

  return `${month}월 ${weekNumber}주`
}

// 날짜 포맷 함수
function formatDateRange(weekStart: string, weekEnd: string) {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`
}

// ── 심각도 스타일 매핑 ──
const SEVERITY_STYLES: Record<string, { border: string; bg: string; badge: string; label: string }> = {
  high:        { border: 'border-red-500', bg: 'bg-red-50', badge: 'bg-red-600 text-white', label: '높음' },
  opportunity: { border: 'border-green-500', bg: 'bg-green-50', badge: 'bg-green-500 text-white', label: '기회' },
  medium:      { border: 'border-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-400 text-gray-900', label: '보통' },
  normal:      { border: 'border-gray-300', bg: 'bg-gray-50', badge: 'bg-gray-400 text-white', label: '정상' },
}

// ── WeeklyExecutiveSummary ──
function WeeklyExecutiveSummary({ summary }: { summary: any }) {
  if (!summary) return null

  const stats = [
    {
      label: '가격 하향',
      value: summary.total_price_down ?? 0,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
    {
      label: '가격 상향',
      value: summary.total_price_up ?? 0,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
    {
      label: '모니터링',
      value: summary.total_monitor ?? 0,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
    },
    {
      label: '긴급',
      value: summary.total_critical ?? 0,
      color: (summary.total_critical ?? 0) > 0 ? 'text-red-600' : 'text-gray-600',
      bg: (summary.total_critical ?? 0) > 0 ? 'bg-red-50' : 'bg-gray-50',
      border: (summary.total_critical ?? 0) > 0 ? 'border-red-200' : 'border-gray-200',
      pulse: (summary.total_critical ?? 0) > 0,
    },
  ]

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">주간 요약 대시보드</h2>
        {(summary.total_critical ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-600 text-white animate-pulse">
            긴급 {summary.total_critical}건
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {stats.map((stat: any) => (
          <div
            key={stat.label}
            className={`${stat.bg} ${stat.border} border rounded-lg p-4 text-center ${
              stat.pulse ? 'animate-pulse' : ''
            }`}
          >
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {summary.top_action_branches && summary.top_action_branches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">주요 조치 지점:</span>
          {summary.top_action_branches.map((branch: string) => (
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

// ── Enhanced BranchIssuesCard ──
function BranchIssuesCard({ issues }: { issues: any[] }) {
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  if (!issues || issues.length === 0) {
    return <div className="text-center py-8 text-gray-500">지점별 이슈가 없습니다</div>
  }

  const toggleBranch = (branch: string) => {
    const newExpanded = new Set(expandedBranches)
    if (newExpanded.has(branch)) {
      newExpanded.delete(branch)
    } else {
      newExpanded.add(branch)
    }
    setExpandedBranches(newExpanded)
  }

  const toggleWeek = (key: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedWeeks(newExpanded)
  }

  // 가나다순 정렬 (API에서 이미 정렬되지만 프론트에서도 보장)
  const sortedIssues = [...issues].sort((a, b) => a.branch.localeCompare(b.branch, 'ko'))

  return (
    <div className="space-y-3">
      {sortedIssues.map((item: any, idx: number) => {
        const isExpanded = expandedBranches.has(item.branch)
        const details: any[] = item.details || []

        // 지점 전체 최고 심각도
        const mainSeverity =
          details.find((d: any) => d.severity === 'high')?.severity ||
          details.find((d: any) => d.severity === 'opportunity')?.severity ||
          details.find((d: any) => d.severity === 'medium')?.severity ||
          'normal'

        const style = SEVERITY_STYLES[mainSeverity] || SEVERITY_STYLES.normal

        // 지점 전체 요약 숫자
        const totalDown = details.reduce((s: number, d: any) => s + (d.summary?.price_down_count ?? 0), 0)
        const totalUp = details.reduce((s: number, d: any) => s + (d.summary?.price_up_count ?? 0), 0)

        return (
          <div
            key={idx}
            className={`rounded-lg border-l-4 ${style.border} ${style.bg} overflow-hidden`}
          >
            {/* Branch header */}
            <div
              className="px-4 py-3 cursor-pointer hover:bg-black/5 transition-colors"
              onClick={() => toggleBranch(item.branch)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 text-lg">{item.branch}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                    {SEVERITY_STYLES[mainSeverity]?.label || '정상'}
                  </span>
                  {totalDown > 0 && (
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                      하향 {totalDown}
                    </span>
                  )}
                  {totalUp > 0 && (
                    <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">
                      상향 {totalUp}
                    </span>
                  )}
                </div>
                <button className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
                  {isExpanded ? '▲ 접기' : `▼ ${details.length}주 보기`}
                </button>
              </div>
              {/* ★ 한줄요약 (접힌 상태에서 표시) */}
              {!isExpanded && item.branch_summary && (
                <div className="text-sm text-gray-600 mt-1">
                  {item.branch_summary}
                </div>
              )}
            </div>

            {/* Per-week breakdown */}
            {isExpanded && (
              <div className="border-t border-black/10 divide-y divide-black/5">
                {details.map((detail: any, i: number) => {
                  const weekKey = `${item.branch}-${i}`
                  const isWeekExpanded = expandedWeeks.has(weekKey)
                  const weekSeverity = SEVERITY_STYLES[detail.severity] || SEVERITY_STYLES.normal
                  const summary = detail.summary || {}

                  return (
                    <div key={i} className="px-4 py-3">
                      {/* Week row header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{detail.week}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${weekSeverity.badge}`}
                          >
                            {weekSeverity.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <span className="text-red-600 font-medium">하향 {summary.price_down_count ?? 0}건</span>
                          {' / '}
                          <span className="text-green-600 font-medium">상향 {summary.price_up_count ?? 0}건</span>
                          {' / '}
                          <span className="text-gray-500 font-medium">관찰 {summary.monitor_count ?? 0}건</span>
                          {summary.total_remaining_rooms != null && (
                            <>
                              {' | '}
                              <span className="text-gray-700 font-medium">잔여 {summary.total_remaining_rooms}실</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Most urgent message */}
                      {summary.most_urgent_message && (
                        <div className="mt-1.5 text-sm text-gray-700 bg-white/60 rounded px-2 py-1">
                          {summary.most_urgent_message}
                        </div>
                      )}

                      {/* Expandable recommendations */}
                      {detail.recommendations && detail.recommendations.length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleWeek(weekKey)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {isWeekExpanded
                              ? '▲ 상세 접기'
                              : `▼ 객실 타입별 상세 ${detail.recommendations.length}건`}
                          </button>

                          {isWeekExpanded && (
                            <div className="mt-2 space-y-2">
                              {detail.recommendations.map((rec: any, ri: number) => {
                                const recAction =
                                  rec.action === 'price_down'
                                    ? { bg: 'bg-red-500 text-white', label: '하향' }
                                    : rec.action === 'price_up'
                                    ? { bg: 'bg-green-500 text-white', label: '상향' }
                                    : { bg: 'bg-gray-400 text-white', label: '관찰' }

                                return (
                                  <div
                                    key={ri}
                                    className="bg-white rounded-md border border-gray-200 px-3 py-2 text-sm"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-gray-900">
                                        {rec.room_type || '-'}
                                      </span>
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${recAction.bg}`}
                                      >
                                        {recAction.label}
                                      </span>
                                      {rec.date && (
                                        <span className="text-xs text-gray-400">{rec.date}</span>
                                      )}
                                    </div>
                                    {rec.message && (
                                      <div className="text-xs text-gray-600 mt-1">{rec.message}</div>
                                    )}
                                    {rec.sales_pace_detail && (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        판매 페이스: {rec.sales_pace_detail}
                                      </div>
                                    )}
                                    {rec.suggested_price != null && (
                                      <div className="text-xs text-blue-700 font-medium mt-1">
                                        → 제안가: {rec.suggested_price?.toLocaleString()}원
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 월/주차 그룹핑 헬퍼 ──
function groupWeeksByMonth(weeks: any[]): Record<string, { label: string; weeks: { weekNum: number; week_start: string; week_end: string; dateRange: string }[] }> {
  const groups: Record<string, { label: string; weeks: { weekNum: number; week_start: string; week_end: string; dateRange: string }[] }> = {}

  weeks.forEach(week => {
    const weekLabel = getWeekLabel(week.week_start)
    // "3월 2주" → month="3월", weekNum=2
    const match = weekLabel.match(/^(\d+)월\s+(\d+)주$/)
    if (!match) return

    const monthKey = match[1]
    const monthLabel = `${match[1]}월`
    const weekNum = parseInt(match[2])
    const dateRange = formatDateRange(week.week_start, week.week_end)

    if (!groups[monthKey]) {
      groups[monthKey] = { label: monthLabel, weeks: [] }
    }
    groups[monthKey].weeks.push({ weekNum, week_start: week.week_start, week_end: week.week_end, dateRange })
  })

  // 각 월 내에서 주차순 정렬
  Object.values(groups).forEach(g => g.weeks.sort((a, b) => a.weekNum - b.weekNum))

  return groups
}

// ── WeekSelector 컴포넌트 ──
function WeekSelector({ availableWeeks, selectedWeek, onSelectWeek, onGenerateWeek }: {
  availableWeeks: any[]
  selectedWeek: string
  onSelectWeek: (week: string) => void
  onGenerateWeek: (week: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [newWeek, setNewWeek] = useState('')

  const grouped = groupWeeksByMonth(availableWeeks)
  // 월 키를 최근 순으로 정렬
  const monthKeys = Object.keys(grouped).sort((a, b) => parseInt(b) - parseInt(a))

  // 현재 선택된 주가 속한 월 찾기
  const selectedLabel = selectedWeek ? getWeekLabel(selectedWeek) : ''
  const selectedMonthMatch = selectedLabel.match(/^(\d+)월/)
  const [activeMonth, setActiveMonth] = useState(selectedMonthMatch?.[1] || monthKeys[0] || '')

  // 선택된 주가 바뀌면 해당 월로 이동
  useEffect(() => {
    if (selectedWeek) {
      const label = getWeekLabel(selectedWeek)
      const match = label.match(/^(\d+)월/)
      if (match) setActiveMonth(match[1])
    }
  }, [selectedWeek])

  const currentGroup = grouped[activeMonth]

  return (
    <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* 1단: 월 선택 */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto">
          {monthKeys.map(mk => (
            <button
              key={mk}
              onClick={() => setActiveMonth(mk)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                mk === activeMonth
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {grouped[mk].label}
            </button>
          ))}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-green-100 text-green-700 hover:bg-green-200 whitespace-nowrap ml-1"
          >
            +
          </button>
        </div>

        {/* 2단: W1~W4 선택 */}
        {currentGroup && (
          <div className="flex items-center gap-2">
            {currentGroup.weeks.map(w => {
              const isSelected = w.week_start === selectedWeek
              return (
                <button
                  key={w.week_start}
                  onClick={() => onSelectWeek(w.week_start)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg transition-colors min-w-[70px] ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-blue-50 border border-gray-200'
                  }`}
                >
                  <span className="text-sm font-bold">W{w.weekNum}</span>
                  <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                    {w.dateRange}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* 새 주차 생성 팝업 */}
        {showPicker && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72">
            <div className="text-sm font-medium text-gray-700 mb-2">생성할 주의 월요일 선택:</div>
            <input
              type="date"
              value={newWeek}
              onChange={(e) => setNewWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (newWeek) { onGenerateWeek(newWeek); setShowPicker(false) } }}
                disabled={!newWeek}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                생성
              </button>
              <button
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WeeklyReviewsPage() {
  const [reviewData, setReviewData] = useState<any>(null)
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [availableWeeks, setAvailableWeeks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAvailableWeeks()
  }, [])

  useEffect(() => {
    if (selectedWeek) {
      fetchReview(selectedWeek)
    }
  }, [selectedWeek])

  const fetchAvailableWeeks = async () => {
    try {
      const response = await fetch('/api/weekly-reviews-v2/list')
      const weeks = await response.json()
      setAvailableWeeks(weeks)

      if (weeks.length > 0) {
        setSelectedWeek(weeks[0].week_start)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch weeks:', error)
      setLoading(false)
    }
  }

  const fetchReview = async (weekStart: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/weekly-reviews-v2?week=${weekStart}`)
      const data = await response.json()
      setReviewData(data)
    } catch (error) {
      console.error('Failed to fetch review:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReview = async (weekStart: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/weekly-reviews-v2?week=${weekStart}`)
      const data = await response.json()
      setReviewData(data)
      setSelectedWeek(data.week_start)

      // 목록에 추가
      const weekExists = availableWeeks.find(w => w.week_start === data.week_start)
      if (!weekExists) {
        setAvailableWeeks(prev => [
          { week_start: data.week_start, week_end: data.week_end },
          ...prev
        ].sort((a, b) => b.week_start.localeCompare(a.week_start)))
      }
    } catch (error) {
      console.error('Failed to generate review:', error)
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

  if (!reviewData) {
    return <EmptyWeeklyReview onGenerate={generateReview} />
  }

  const executiveSummary = reviewData.weekly_executive_summary
  const branchIssues = reviewData.trend_analysis?.branch_issues || []
  const anomalies = reviewData.trend_analysis?.anomalies || []
  const topPerformers = reviewData.top_branches || []
  const bottomPerformers = reviewData.bottom_branches || []
  const topAchievers = reviewData.next_week_strategy?.top_achievers || []
  const bottomAchievers = reviewData.next_week_strategy?.bottom_achievers || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">주간 리뷰</h1>
          <p className="text-sm text-gray-500 mt-1">
            {getWeekLabel(reviewData.week_start)} ({formatDateRange(reviewData.week_start, reviewData.week_end)})
          </p>
        </div>
      </header>

      {/* 주차 선택: 월 → W1~W4 */}
      <WeekSelector
        availableWeeks={availableWeeks}
        selectedWeek={selectedWeek}
        onSelectWeek={setSelectedWeek}
        onGenerateWeek={generateReview}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 1. 주간 요약 대시보드 */}
        <WeeklyExecutiveSummary summary={executiveSummary} />

        {/* 2. 지점별 주요 이슈 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">지점별 주요 이슈</h2>
          <BranchIssuesCard issues={branchIssues} />
        </section>

        {/* 3. 이상 징후 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">이상 징후</h2>
          <div className="space-y-3">
            {anomalies.length > 0 ? (
              anomalies.map((item: any, idx: number) => (
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
                    이번주: {item.this_week_pickup?.toLocaleString()}원 | 전주: {item.prev_week_pickup?.toLocaleString()}원
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">
                    {item.message}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">이상 징후가 없습니다</div>
            )}
          </div>
        </section>

        {/* 4. 성과 Top/Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">주간 성과 Top 5</h2>
            <div className="space-y-3">
              {topPerformers.map((item: any, idx: number) => (
                <div key={idx} className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        이번주: {item.this_week_pickup?.toLocaleString()}원
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">주간 성과 Bottom 5</h2>
            <div className="space-y-3">
              {bottomPerformers.map((item: any, idx: number) => (
                <div key={idx} className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        이번주: {item.this_week_pickup?.toLocaleString()}원
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

        {/* 5. 목표 달성률 Top/Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">목표 달성률 Top 5</h2>
            <div className="space-y-3">
              {topAchievers.map((item: any, idx: number) => (
                <div key={idx} className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        실적: {item.actual?.toLocaleString()}원 / 목표: {item.target?.toLocaleString()}원
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {item.achievement_pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">목표 달성률 Bottom 5</h2>
            <div className="space-y-3">
              {bottomAchievers.map((item: any, idx: number) => (
                <div key={idx} className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {idx + 1}. {item.branch}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        실적: {item.actual?.toLocaleString()}원 / 목표: {item.target?.toLocaleString()}원
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">
                        {item.achievement_pct.toFixed(0)}%
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
