'use client'

import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [dailyData, setDailyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState('all')

  useEffect(() => {
    fetchData()
  }, [selectedBranch])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [daily, monthly, weekly] = await Promise.all([
        fetch(`/api/daily?branch=${selectedBranch}`).then(r => r.json()),
        fetch(`/api/monthly?branch=${selectedBranch}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${selectedBranch}`).then(r => r.json()),
      ])
      
      setDailyData(daily)
      setMonthlyData(monthly)
      setWeeklyData(weekly)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const branches = [
    '전지점', '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
    '당진터미널점', '동탄점(호텔)', '명동점', '부산기장점', '부산송도해변점',
    '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
    '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
    '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
    '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">📊 M1버프 현황판</h1>
          <p className="text-sm text-gray-500 mt-1">실시간 현황</p>
        </div>
      </header>

      {/* 지점 필터 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch === '전지점' ? 'all' : branch)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  (branch === '전지점' && selectedBranch === 'all') ||
                  branch === selectedBranch
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 오늘 실적 */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            오늘 실적 ({dailyData?.date})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">픽업매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.pickup?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">2월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.feb_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">3월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.mar_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">4월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.apr_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">OCC 개선률</span>
              <div className="text-2xl font-bold text-green-600 mt-2">
                {dailyData?.occ_improvement 
                  ? `${(dailyData.occ_improvement * 100).toFixed(1)}%` 
                  : '-'}
              </div>
              <span className="text-xs text-gray-500">D-1 대비</span>
            </div>
          </div>
        </div>

        {/* 월 누적 */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            월 누적 실적
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">2월 C/I 누적</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.feb?.cumulative?.toLocaleString('ko-KR') || 0}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">달성률:</span>
                <span className="text-lg font-bold text-green-600">
                  {monthlyData?.feb?.achievement_rate
                    ? `${(monthlyData.feb.achievement_rate * 100).toFixed(2)}%`
                    : '-'}
                </span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">3월 C/I 누적</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.mar?.cumulative?.toLocaleString('ko-KR') || 0}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">달성률:</span>
                <span className="text-lg font-bold text-yellow-600">
                  {monthlyData?.mar?.achievement_rate
                    ? `${(monthlyData.mar.achievement_rate * 100).toFixed(2)}%`
                    : '-'}
                </span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">4월 C/I 누적</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.apr?.ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className="mt-2 text-sm text-gray-500">목표 미설정</div>
            </div>
          </div>
        </div>

        {/* 최근 7일 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-bold text-gray-900 mb-4">최근 일주일 매출 추이</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">날짜</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">픽업</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">2월</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">3월</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">4월</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeklyData?.days?.map((day: any) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{day.date} ({day.day})</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {day.pickup?.toLocaleString('ko-KR') || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {day.feb?.toLocaleString('ko-KR') || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {day.mar?.toLocaleString('ko-KR') || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {day.apr?.toLocaleString('ko-KR') || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
