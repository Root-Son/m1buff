'use client'

import { useEffect, useState, useRef } from 'react'
import { Chart, ChartConfiguration, registerables } from 'chart.js'

Chart.register(...registerables)

const BRANCHES = [
  '전지점', '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
  '당진터미널점', '동탄점(호텔)', '명동점', '부산기장점', '부산송도해변점',
  '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
  '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
  '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
  '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
]

const BRANCH_ROOMTYPES: Record<string, string[]> = {
  "강남예전로이움점": ["스튜디오", "스튜디오 랜덤", "스튜디오 베리어프리", "패밀리 투룸", "프리미어 스위트"],
  "강남예전시그니티점": ["스튜디오", "패밀리 투룸", "프리미어 스위트 W", "프리미어 스위트 랜덤"],
  "거북섬점": ["스튜디오", "스튜디오 랜덤", "스튜디오 시티", "프리미어 스위트"],
  "낙산해변": ["스튜디오", "스튜디오 설악", "스튜디오 패밀리", "프리미어 스위트 오션"],
  "당진터미널점": ["스튜디오", "스튜디오 로프트", "스튜디오 싱글", "스튜디오 트윈"],
  "동탄점(호텔)": ["스탠다드", "스탠다드 배리어프리", "스탠다드 트윈", "스탠다드(욕조)"],
  "명동점": ["스튜디오", "스튜디오 시티", "스튜디오 테라스", "스튜디오 파노라마"],
  "부산기장점": ["패밀리 투룸", "패밀리 투룸 오션", "패밀리 쓰리룸", "패밀리 쓰리룸 오션"],
  "부산송도해변점": ["스튜디오", "스튜디오 오션", "스튜디오 트윈", "스튜디오 패밀리"],
  "부산시청점": ["스튜디오", "스튜디오 W", "스튜디오 랜덤", "스튜디오 비즈니스", "스튜디오 시티"],
  "부산역점": ["패밀리 투룸 G", "패밀리 쓰리룸 G", "프리미어 스위트 G", "프리미어 스위트 W"],
  "부티크남포BIFF점": ["스튜디오", "스튜디오 시티", "프리미어 스위트"],
  "부티크익선점": ["스튜디오", "프리미어 스위트", "프리미어 스위트 W"],
  "서면점": ["스튜디오", "스튜디오 랜덤", "스튜디오 트윈", "프리미어 스위트"],
  "속초등대해변점": ["스튜디오", "스튜디오 랜덤", "스튜디오 오션", "프리미어 스위트"],
  "속초자이엘라더비치": ["스튜디오", "스튜디오 오션", "프리미어 스위트"],
  "속초중앙점": ["스튜디오", "스튜디오 랜덤", "스튜디오 패밀리", "프리미어 스위트"],
  "속초해변": ["스튜디오", "스튜디오 랜덤", "스튜디오 패밀리", "프리미어 스위트"],
  "속초해변 AB점": ["스튜디오", "스튜디오 오션", "프리미어 스위트"],
  "속초해변C점": ["스튜디오", "스튜디오 패밀리", "프리미어 스위트"],
  "송도달빛공원점": ["스튜디오", "스튜디오 로프트", "스튜디오 패밀리"],
  "스타즈울산점": ["스탠다드 더블", "스탠다드 싱글", "스탠다드 트윈", "디럭스 패밀리 트윈", "주니어 스위트", "스위트"],
  "웨이브파크점": ["스튜디오", "스튜디오 로프트"],
  "인천차이나타운": ["스튜디오", "스튜디오 시티", "프리미어 스위트"],
  "제주공항점": ["스튜디오", "스튜디오 랜덤", "프리미어 스위트"],
  "해운대역": ["스튜디오", "스튜디오 랜덤", "스튜디오 트윈", "프리미어 스위트", "프리미어 스위트 패밀리"],
  "해운대패러그라프점": ["스튜디오", "스튜디오 W", "스튜디오 랜덤", "스튜디오 패밀리", "패밀리 투룸", "패밀리 쓰리룸"]
}

export default function Dashboard() {
  const [dailyData, setDailyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedRoomType, setSelectedRoomType] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(2)
  const [weekOffset, setWeekOffset] = useState(0)

  const weeklyChartRef = useRef<HTMLCanvasElement>(null)
  const roomTypeChartRef = useRef<HTMLCanvasElement>(null)
  const weeklyChartInstance = useRef<Chart | null>(null)
  const roomTypeChartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    fetchData()
  }, [selectedBranch])

  useEffect(() => {
    if (weeklyData) {
      renderWeeklyChart()
    }
    return () => {
      weeklyChartInstance.current?.destroy()
    }
  }, [weeklyData])

  useEffect(() => {
    renderRoomTypeChart()
    return () => {
      roomTypeChartInstance.current?.destroy()
    }
  }, [selectedRoomType, weekOffset])

  const fetchData = async () => {
    setLoading(true)
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const [daily, monthly, weekly] = await Promise.all([
        fetch(`/api/daily?branch=${branch}`).then(r => r.json()),
        fetch(`/api/monthly?branch=${branch}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${branch}`).then(r => r.json()),
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

  const renderWeeklyChart = () => {
    if (!weeklyChartRef.current || !weeklyData?.days) return

    weeklyChartInstance.current?.destroy()

    const ctx = weeklyChartRef.current.getContext('2d')
    if (!ctx) return

    const labels = weeklyData.days.map((d: any) => {
      const date = new Date(d.date)
      return `${date.getMonth() + 1}/${date.getDate()} (${d.day})`
    })

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '픽업매출',
            data: weeklyData.days.map((d: any) => d.pickup),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
          },
          {
            label: '2월 C/I',
            data: weeklyData.days.map((d: any) => d.feb),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
          },
          {
            label: '3월 C/I',
            data: weeklyData.days.map((d: any) => d.mar),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
          },
          {
            label: '4월 C/I',
            data: weeklyData.days.map((d: any) => d.apr),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + new Intl.NumberFormat('ko-KR').format(ctx.parsed.y as number)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value as number)
            }
          }
        }
      }
    }

    weeklyChartInstance.current = new Chart(ctx, config)
  }

  const renderRoomTypeChart = () => {
    if (!roomTypeChartRef.current) return

    roomTypeChartInstance.current?.destroy()

    const ctx = roomTypeChartRef.current.getContext('2d')
    if (!ctx) return

    // 샘플 데이터
    const dates = ['2/27 (금)', '2/28 (토)', '3/1 (일)', '3/2 (월)', '3/3 (화)', '3/4 (수)', '3/5 (목)']
    const occD7 = [0.65, 0.68, 0.72, 0.70, 0.75, 0.73, 0.78]
    const occD1 = [0.68, 0.71, 0.75, 0.73, 0.78, 0.76, 0.80]
    const occ = [0.70, 0.73, 0.77, 0.75, 0.80, 0.78, 0.82]
    const guardrail = [85000, 85000, 90000, 92000, 95000, 93000, 98000]
    const yolo = [82000, 82000, 87000, 89000, 92000, 90000, 95000]

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'D-7 OCC',
            data: occD7,
            backgroundColor: 'rgba(156, 163, 175, 0.6)',
            yAxisID: 'y',
            order: 1
          },
          {
            label: 'D-1 OCC',
            data: occD1,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'OCC',
            data: occ,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            yAxisID: 'y',
            order: 3
          },
          {
            label: '가드레일',
            data: guardrail,
            type: 'line',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y1'
          },
          {
            label: '셋팅가',
            data: yolo,
            type: 'line',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || ''
                if (label) label += ': '
                if (context.dataset.yAxisID === 'y') {
                  label += ((context.parsed.y as number) * 100).toFixed(1) + '%'
                } else {
                  label += new Intl.NumberFormat('ko-KR').format(context.parsed.y as number)
                }
                return label
              }
            }
          }
        },
        scales: {
          y: {
            position: 'left',
            title: { display: true, text: 'OCC (%)' },
            min: 0,
            max: 1,
            ticks: { callback: (v) => ((v as number) * 100).toFixed(0) + '%' }
          },
          y1: {
            position: 'right',
            title: { display: true, text: '가격 (원)' },
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => new Intl.NumberFormat('ko-KR').format(v as number) }
          }
        }
      }
    }

    roomTypeChartInstance.current = new Chart(ctx, config)
  }

  const roomTypes = selectedBranch === '전지점' ? [] : (BRANCH_ROOMTYPES[selectedBranch] || [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
            {BRANCHES.map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">월 누적 실적</h2>
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

        {/* 최근 7일 차트 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">최근 일주일 매출 추이</h2>
          <div className="h-80">
            <canvas ref={weeklyChartRef}></canvas>
          </div>
        </div>

        {/* 룸타입별 성과 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">룸타입별 성과 (1주일)</h2>
              <p className="text-sm text-gray-500 mt-1">2026.02.27 ~ 03.05</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setWeekOffset(weekOffset - 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium min-w-[80px] text-center">
                  {weekOffset === 0 ? '이번주' : weekOffset > 0 ? `+${weekOffset}주` : `${weekOffset}주`}
                </span>
                <button 
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              {roomTypes.length > 0 && (
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setSelectedRoomType('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                      selectedRoomType === 'all'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600'
                    }`}
                  >
                    전체
                  </button>
                  {roomTypes.map(rt => (
                    <button
                      key={rt}
                      onClick={() => setSelectedRoomType(rt)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                        selectedRoomType === rt
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600'
                      }`}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="h-96">
            <canvas ref={roomTypeChartRef}></canvas>
          </div>
        </div>

        {/* 룸타입별 상세 데이터 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">룸타입별 상세 데이터</h2>
                <p className="text-sm text-gray-500 mt-1">선택한 월의 지표</p>
              </div>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                {[2, 3, 4].map(month => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md ${
                      selectedMonth === month
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600'
                    }`}
                  >
                    {month}월
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">룸타입</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">OCC</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">가드레일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">셋팅가</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ADR</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">전체</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-green-600">-</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
