'use client'

import { useState, useEffect } from 'react'

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
      // 저장된 이슈 날짜 목록 가져오기
      const response = await fetch('/api/daily-issues/list')
      const dates = await response.json()
      setAvailableDates(dates)
      
      // 가장 최근 날짜 선택
      if (dates.length > 0) {
        setSelectedDate(dates[0])
      }
      // 날짜 없어도 여기서는 생성 안 함
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

  const generateIssues = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/daily-issues')
      const data = await response.json()
      setIssuesData(data)
      setSelectedDate(data.date)
      // 날짜 목록에 추가
      setAvailableDates(prev => [data.date, ...prev.filter(d => d !== data.date)])
    } catch (error) {
      console.error('Failed to generate issues:', error)
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
      // 날짜 목록에 추가
      setAvailableDates(prev => [data.date, ...prev.filter(d => d !== data.date)])
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
          <button
            onClick={generateIssues}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            지금 생성하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">🔥 일간 이슈</h1>
          <p className="text-sm text-gray-500 mt-1">
            {issuesData.date} 기준 (vs {issuesData.compared_to})
          </p>
        </div>
      </header>

      {/* 날짜 선택 */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
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
                {new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </button>
            ))}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 whitespace-nowrap relative"
            >
              + 날짜 선택 생성
            </button>
            {showDatePicker && (
              <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                <div className="text-sm font-medium text-gray-700 mb-2">생성할 날짜 선택:</div>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 긴급 대응 필요 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">🚨 긴급 대응 필요</h2>
          <div className="space-y-3">
            {issuesData.urgent_actions && issuesData.urgent_actions.length > 0 ? (
              issuesData.urgent_actions.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    item.severity === 'high'
                      ? 'bg-red-50 border-red-500'
                      : item.severity === 'opportunity'
                      ? 'bg-green-50 border-green-500'
                      : item.severity === 'medium'
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-gray-50 border-gray-500'
                  }`}
                >
                  <div className="font-bold text-gray-900 text-lg mb-2">
                    {item.period} (D-{item.days_until})
                  </div>
                  <div className="text-sm text-gray-700 mb-2">
                    평균 OCC: {(item.avg_occ * 100).toFixed(1)}% | 
                    영향 지점: {item.total_affected}개
                    {item.affected_branches && ` (${item.affected_branches.join(', ')})`}
                  </div>
                  <div className="text-sm font-medium text-blue-700 mb-3">
                    💡 {item.recommendation}
                  </div>
                  {item.details && item.details.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600 font-semibold mb-1">주요 사례:</div>
                      {item.details.map((detail: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 ml-2">
                          • {detail.branch} {detail.room_type} ({detail.date}): OCC {(detail.occ * 100).toFixed(1)}%, ADR {detail.adr?.toLocaleString()}원
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">긴급 대응이 필요한 항목이 없습니다</div>
            )}
          </div>
        </section>

        {/* 가격 조정 기회 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">💰 가격 조정 기회</h2>
          <div className="space-y-3">
            {issuesData.pricing_opportunities && issuesData.pricing_opportunities.length > 0 ? (
              issuesData.pricing_opportunities.map((item: any, idx: number) => (
                <div key={idx} className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                  <div className="font-bold text-gray-900 text-lg mb-2">
                    {item.period}
                  </div>
                  <div className="text-sm text-gray-700 mb-2">
                    평균 OCC 증가: +{(item.avg_occ_change * 100).toFixed(1)}%p | 
                    영향 지점: {item.total_affected}개
                    {item.affected_branches && ` (${item.affected_branches.join(', ')})`}
                  </div>
                  <div className="text-sm font-medium text-blue-700 mb-3">
                    💡 {item.recommendation}
                  </div>
                  {item.details && item.details.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600 font-semibold mb-1">주요 사례:</div>
                      {item.details.map((detail: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 ml-2">
                          • {detail.branch} {detail.room_type} ({detail.date}): OCC {(detail.occ * 100).toFixed(1)}% (+{(detail.occ_change * 100).toFixed(1)}%p)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">가격 조정 기회가 없습니다</div>
            )}
          </div>
        </section>

        {/* 이상 징후 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ 이상 징후</h2>
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
              <div className="text-center py-8 text-gray-500">이상 징후가 없습니다</div>
            )}
          </div>
        </section>

        {/* 성과 Top/Bottom */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 5 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">✅ 잘한 지점 Top 5</h2>
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

          {/* Bottom 5 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ 개선 필요 지점 Bottom 5</h2>
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
