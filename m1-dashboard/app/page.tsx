'use client'

import { useEffect, useState } from 'react'

const BRANCHES = [
  '전지점', '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
  '당진터미널점', '동탄점(호텔)', '명동점', '부산기장점', '부산송도해변점',
  '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
  '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
  '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
  '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
]

export default function Dashboard() {
  const [selectedBranch, setSelectedBranch] = useState('전지점')
  const [selectedMonth, setSelectedMonth] = useState(2)
  const [loading, setLoading] = useState(true)
  const [toplineData, setToplineData] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [selectedBranch, selectedMonth])

  const fetchData = async () => {
    setLoading(true)
    try {
      const topline = await fetch(`/api/topline?branch=${selectedBranch}&month=${selectedMonth}`).then(r => r.json())
      setToplineData(topline)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">로딩중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">📊 M1버프 현황판</h1>
        </div>
      </header>

      <div className="bg-white border-b sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-2 flex-wrap">
            {BRANCHES.sort((a, b) => a.localeCompare(b, 'ko')).map(branch => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className={`px-4 py-2 rounded ${
                  selectedBranch === branch
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {branch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">TOPLINE (체크인 기준)</h2>
          <div className="flex gap-2 mb-4">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1 rounded ${
                  selectedMonth === m ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
          {toplineData && (
            <div className="grid grid-cols-1 gap-4">
              {toplineData.weeks?.map((week: any) => (
                <div key={week.week_num} className="bg-white p-4 rounded shadow">
                  <div className="text-sm text-gray-600">
                    {week.start_date} ~ {week.end_date}
                  </div>
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('ko-KR').format(week.ci_amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
