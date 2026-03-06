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
  
  const weekNumber = Math.floor((start.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  
  return `${month}월 ${weekNumber}주`
}

// 날짜 포맷 함수
function formatDateRange(weekStart: string, weekEnd: string) {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`
}

// 지점별 이슈 컴포넌트
function BranchIssuesCard({ issues }: { issues: any[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!issues || issues.length === 0) {
    return <div className="text-center py-8 text-gray-500">지점별 이슈가 없습니다</div>
  }
  
  const displayIssues = isExpanded ? issues : issues.slice(0, 5)
  
  return (
    <div className="space-y-3">
      {displayIssues.map((item: any, idx: number) => (
        <div
          key={idx}
          className={`p-4 rounded-lg border-l-4 ${
            item.severity === 'high'
              ? 'bg-red-50 border-red-500'
              : item.severity === 'opportunity'
              ? 'bg-green-50 border-green-500'
              : 'bg-yellow-50 border-yellow-500'
          }`}
        >
          <div className="font-semibold text-gray-900">{item.branch}</div>
          <div className="text-sm text-gray-700 mt-1">{item.message}</div>
        </div>
      ))}
      {issues.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {isExpanded ? '▲ 접기' : `▼ ${issues.length - 5}개 더보기`}
        </button>
      )}
    </div>
  )
}

export default function WeeklyReviewsPage() {
  const [reviewData, setReviewData] = useState<any>(null)
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [availableWeeks, setAvailableWeeks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [newWeek, setNewWeek] = useState('')

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
      const response = await fetch('/api/weekly-reviews/list')
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
      const response = await fetch(`/api/weekly-reviews?week=${weekStart}`)
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
    setShowWeekPicker(false)
    try {
      const response = await fetch(`/api/weekly-reviews?week=${weekStart}`)
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl mb-4">주간 리뷰 데이터가 없습니다</div>
          <div className="space-y-2">
            <input
              type="date"
              value={newWeek}
              onChange={(e) => setNewWeek(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => newWeek && generateReview(newWeek)}
              disabled={!newWeek}
              className="ml-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              생성하기
            </button>
          </div>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold text-gray-900">📊 주간 리뷰</h1>
          <p className="text-sm text-gray-500 mt-1">
            {getWeekLabel(reviewData.week_start)} ({formatDateRange(reviewData.week_start, reviewData.week_end)})
          </p>
        </div>
      </header>

      {/* 주차 선택 */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 overflow-x-auto relative">
            {availableWeeks.map((week) => (
              <button
                key={week.week_start}
                onClick={() => setSelectedWeek(week.week_start)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  week.week_start === selectedWeek
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getWeekLabel(week.week_start)} ({formatDateRange(week.week_start, week.week_end)})
              </button>
            ))}
            <button
              onClick={() => setShowWeekPicker(!showWeekPicker)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 whitespace-nowrap"
            >
              + 주차 선택 생성
            </button>
            {showWeekPicker && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                <div className="text-sm font-medium text-gray-700 mb-2">생성할 주의 월요일 선택:</div>
                <input
                  type="date"
                  value={newWeek}
                  onChange={(e) => setNewWeek(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => newWeek && generateReview(newWeek)}
                    disabled={!newWeek}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    생성
                  </button>
                  <button
                    onClick={() => setShowWeekPicker(false)}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 지점별 주요 이슈 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 지점별 주요 이슈</h2>
          <BranchIssuesCard issues={branchIssues} />
        </section>

        {/* 이상 징후 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ 이상 징후</h2>
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

        {/* 성과 Top/Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">📈 주간 성과 Top 5</h2>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">📉 주간 성과 Bottom 5</h2>
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

        {/* 목표 달성률 Top/Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">🎯 목표 달성률 Top 5</h2>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ 목표 달성률 Bottom 5</h2>
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
