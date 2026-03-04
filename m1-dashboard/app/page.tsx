'use client'

import { useEffect, useState, useRef } from 'react'
import { Chart, ChartConfiguration, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

Chart.register(...registerables, ChartDataLabels)

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
  const [toplineData, setToplineData] = useState<any>(null)
  const [roomTypeData, setRoomTypeData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState('전지점') // 디폴트 전지점
  const [selectedRoomType, setSelectedRoomType] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(2)
  const [toplineMonth, setToplineMonth] = useState(3) // Topline 월 필터
  const [currentWeek, setCurrentWeek] = useState(0) // ISO week offset
  const [roomTypeWeekOffset, setRoomTypeWeekOffset] = useState<number | null>(0) // 0 = 이번주 디폴트
  const [selectedDate, setSelectedDate] = useState<string>('') // 일 실적 날짜 선택

  // ISO Week 계산
  const getISOWeek = (date: Date) => {
    const target = new Date(date.valueOf())
    const dayNr = (date.getDay() + 6) % 7
    target.setDate(target.getDate() - dayNr + 3)
    const firstThursday = target.valueOf()
    target.setMonth(0, 1)
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  }

  const getWeekRange = (weekOffset: number) => {
    const today = new Date()
    const currentISOWeek = getISOWeek(today)
    const targetWeek = currentISOWeek + weekOffset
    
    // 해당 주의 월요일 찾기
    const jan4 = new Date(today.getFullYear(), 0, 4)
    const monday = new Date(jan4)
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (targetWeek - 1) * 7)
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    
    return {
      week: targetWeek,
      year: today.getFullYear(),
      start: monday,
      end: sunday,
      label: `${monday.getMonth() + 1}/${monday.getDate()} ~ ${sunday.getMonth() + 1}/${sunday.getDate()}`
    }
  }

  const weekRange = getWeekRange(currentWeek)

  const weeklyChartRef = useRef<HTMLCanvasElement>(null)
  const roomTypeChartRef = useRef<HTMLCanvasElement>(null)
  const weeklyChartInstance = useRef<Chart | null>(null)
  const roomTypeChartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    fetchData()
    fetchRoomTypeData() // 초기 로드 시에도 실행
  }, [selectedBranch, selectedDate, selectedMonth, toplineMonth, currentWeek])

  useEffect(() => {
    if (weeklyData) {
      renderWeeklyChart()
    }
    return () => {
      weeklyChartInstance.current?.destroy()
    }
  }, [weeklyData])

  useEffect(() => {
    // 이번주가 디폴트이므로 항상 렌더링
    fetchRoomTypeData()
  }, [selectedRoomType, roomTypeWeekOffset, selectedBranch])

  const fetchRoomTypeData = async () => {
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const response = await fetch(
        `/api/roomtype?branch=${branch}&weekOffset=${roomTypeWeekOffset}&roomType=${selectedRoomType}`
      )
      const data = await response.json()
      setRoomTypeData(data)
    } catch (error) {
      console.error('룸타입 데이터 로드 실패:', error)
    }
  }

  useEffect(() => {
    if (roomTypeData) {
      renderRoomTypeChart()
    }
    return () => {
      roomTypeChartInstance.current?.destroy()
    }
  }, [roomTypeData])

  const fetchData = async () => {
    setLoading(true)
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const dateParam = selectedDate ? `&date=${selectedDate}` : ''
      
      // 주간 실적 날짜 계산
      const weekRange = getWeekRange(currentWeek)
      const weekStartStr = weekRange.start.toISOString().split('T')[0]
      const weekEndStr = weekRange.end.toISOString().split('T')[0]
      
      const [daily, monthly, weekly, topline] = await Promise.all([
        fetch(`/api/daily?branch=${branch}${dateParam}`).then(r => r.json()),
        fetch(`/api/monthly?branch=${branch}&month=${selectedMonth}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${branch}&startDate=${weekStartStr}&endDate=${weekEndStr}`).then(r => r.json()),
        fetch(`/api/topline?branch=${branch}&month=${toplineMonth}`).then(r => r.json()),
      ])
      
      setDailyData(daily)
      setMonthlyData(monthly)
      setWeeklyData(weekly)
      setToplineData(topline)
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
            label: `${weeklyData.month1 || ''}월 C/I`,
            data: weeklyData.days.map((d: any) => d.month1),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
          },
          {
            label: `${weeklyData.month2 || ''}월 C/I`,
            data: weeklyData.days.map((d: any) => d.month2),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
          },
          {
            label: `${weeklyData.month3 || ''}월 C/I`,
            data: weeklyData.days.map((d: any) => d.month3),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top',
            formatter: (value: any) => {
              return new Intl.NumberFormat('ko-KR').format(value)
            },
            font: { size: 10 }
          },
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
    if (!roomTypeChartRef.current || !roomTypeData?.days) return

    roomTypeChartInstance.current?.destroy()

    const ctx = roomTypeChartRef.current.getContext('2d')
    if (!ctx) return

    // 실제 데이터
    const labels = roomTypeData.days.map((d: any) => {
      const date = new Date(d.date)
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
      return `${date.getMonth() + 1}/${date.getDate()} (${dayName})`
    })

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'D-7 OCC',
            data: roomTypeData.days.map((d: any) => d.occ_7d_ago),
            backgroundColor: 'rgba(156, 163, 175, 0.6)',
            yAxisID: 'y',
            order: 1
          },
          {
            label: 'D-1 OCC',
            data: roomTypeData.days.map((d: any) => d.occ_1d_ago),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'OCC',
            data: roomTypeData.days.map((d: any) => d.occ),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            yAxisID: 'y',
            order: 3
          },
          {
            label: '셋팅가',
            data: roomTypeData.days.map((d: any) => d.yolo_price),
            type: 'line',
            borderColor: 'rgba(245, 158, 11, 1)',
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y1',
            order: 0
          },
          {
            label: '가드레일',
            data: roomTypeData.days.map((d: any) => d.guardrail_price || null),
            type: 'line',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 3,
            yAxisID: 'y1',
            order: 0
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top',
            formatter: (value: any, context: any) => {
              if (context.dataset.yAxisID === 'y') {
                return (value * 100).toFixed(0) + '%'
              } else {
                return new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value)
              }
            },
            font: { size: 10 }
          },
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
        {/* Topline */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Topline (체크인 기준)</h2>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                <button
                  key={month}
                  onClick={() => setToplineMonth(month)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                    toplineMonth === month
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {month}월
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{toplineData?.month || ''}월 C/I 총합</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {toplineData?.total_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                목표: {toplineData?.total_target?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm font-medium mt-1 ${(toplineData?.achievement_rate || 0) >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                달성률 {(toplineData?.achievement_rate || 0).toFixed(1)}%
              </div>
            </div>
            {toplineData?.weeks?.map((week: any) => (
              <div key={week.week_num} className="bg-white p-6 rounded-lg shadow-sm border">
                <span className="text-sm font-medium text-gray-600">W{week.week_num} ({week.label})</span>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {week.ci_amount?.toLocaleString('ko-KR') || 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 일 실적 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">일 실적</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const date = new Date(selectedDate || dailyData?.date || new Date())
                  date.setDate(date.getDate() - 1)
                  setSelectedDate(date.toISOString().split('T')[0])
                }}
                className="p-2 hover:bg-gray-100 rounded-lg border"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <input 
                type="date" 
                value={selectedDate || dailyData?.date || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <button 
                onClick={() => {
                  const date = new Date(selectedDate || dailyData?.date || new Date())
                  date.setDate(date.getDate() + 1)
                  setSelectedDate(date.toISOString().split('T')[0])
                }}
                className="p-2 hover:bg-gray-100 rounded-lg border"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">픽업매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.pickup?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.pickup_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.pickup_dod || 0) >= 0 ? '+' : ''}{(dailyData?.pickup_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{dailyData?.month1 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month1_ci_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.month1_ci_dod || 0) >= 0 ? '+' : ''}{(dailyData?.month1_ci_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{dailyData?.month2 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month2_ci_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.month2_ci_dod || 0) >= 0 ? '+' : ''}{(dailyData?.month2_ci_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{dailyData?.month3 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month3_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month3_ci_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.month3_ci_dod || 0) >= 0 ? '+' : ''}{(dailyData?.month3_ci_dod || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* 주간 실적 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">주간 실적</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentWeek(currentWeek - 1)}
                className="p-2 hover:bg-gray-100 rounded-lg border"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium min-w-[200px] text-center">
                {weekRange.year}년 W{weekRange.week} ({weekRange.label})
              </span>
              <button 
                onClick={() => setCurrentWeek(currentWeek + 1)}
                className="p-2 hover:bg-gray-100 rounded-lg border"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">픽업매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {weeklyData?.total_pickup?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(weeklyData?.total_pickup_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                WoW {(weeklyData?.total_pickup_wow || 0) >= 0 ? '+' : ''}{(weeklyData?.total_pickup_wow || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{weeklyData?.month1 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {weeklyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(weeklyData?.month1_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                WoW {(weeklyData?.month1_ci_wow || 0) >= 0 ? '+' : ''}{(weeklyData?.month1_ci_wow || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{weeklyData?.month2 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {weeklyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(weeklyData?.month2_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                WoW {(weeklyData?.month2_ci_wow || 0) >= 0 ? '+' : ''}{(weeklyData?.month2_ci_wow || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{weeklyData?.month3 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {weeklyData?.month3_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(weeklyData?.month3_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                WoW {(weeklyData?.month3_ci_wow || 0) >= 0 ? '+' : ''}{(weeklyData?.month3_ci_wow || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* 월 실적 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">월 실적</h2>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                    selectedMonth === month
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {month}월
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">픽업매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.pickup?.toLocaleString('ko-KR') || '-'}
              </div>
              <div className={`text-sm mt-1 ${(monthlyData?.pickup_mom || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                MoM {(monthlyData?.pickup_mom || 0) >= 0 ? '+' : ''}{(monthlyData?.pickup_mom || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{monthlyData?.month1 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.month1_ci?.toLocaleString('ko-KR') || '-'}
              </div>
              <div className={`text-sm mt-1 ${(monthlyData?.month1_ci_mom || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                MoM {(monthlyData?.month1_ci_mom || 0) >= 0 ? '+' : ''}{(monthlyData?.month1_ci_mom || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{monthlyData?.month2 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.month2_ci?.toLocaleString('ko-KR') || '-'}
              </div>
              <div className={`text-sm mt-1 ${(monthlyData?.month2_ci_mom || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                MoM {(monthlyData?.month2_ci_mom || 0) >= 0 ? '+' : ''}{(monthlyData?.month2_ci_mom || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">{monthlyData?.month3 || ''}월 C/I</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {monthlyData?.month3_ci?.toLocaleString('ko-KR') || '-'}
              </div>
              <div className={`text-sm mt-1 ${(monthlyData?.month3_ci_mom || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                MoM {(monthlyData?.month3_ci_mom || 0) >= 0 ? '+' : ''}{(monthlyData?.month3_ci_mom || 0).toFixed(1)}%
              </div>
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
              <h2 className="text-lg font-bold text-gray-900">룸타입별 성과</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setRoomTypeWeekOffset((roomTypeWeekOffset || 0) - 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg border"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium min-w-[80px] text-center">
                  {roomTypeWeekOffset === 0 
                    ? '이번주' 
                    : roomTypeWeekOffset && roomTypeWeekOffset > 0 
                    ? `+${roomTypeWeekOffset}주` 
                    : `${roomTypeWeekOffset}주`}
                </span>
                <button 
                  onClick={() => setRoomTypeWeekOffset((roomTypeWeekOffset || 0) + 1)}
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
