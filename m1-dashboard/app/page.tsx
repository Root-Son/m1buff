'use client'

import { useEffect, useState, useRef } from 'react'
import { Chart, ChartConfiguration, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { ROOM_COUNTS } from '@/lib/pricing-engine'

Chart.register(...registerables, ChartDataLabels)

const BRANCHES = [
  '전지점', '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
  '당진터미널점', '호텔 동탄', '명동점', '부산기장점', '부산송도해변점',
  '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
  '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
  '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
  '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
]


export default function Dashboard() {
  const [dailyData, setDailyData] = useState<any>(null)
  const [prevDailyData, setPrevDailyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [prevWeeklyData, setPrevWeeklyData] = useState<any>(null)
  const [toplineData, setToplineData] = useState<any>(null)
  const [roomTypeData, setRoomTypeData] = useState<any>(null)
  const [monthlySummaryData, setMonthlySummaryData] = useState<any>(null)
  const [channelData, setChannelData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState('전지점') // 디폴트 전지점
  const [selectedRoomType, setSelectedRoomType] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [toplineMonth, setToplineMonth] = useState(3) // Topline 월 필터
  const [currentWeek, setCurrentWeek] = useState(0) // 0 = 이번주
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
  const channelChartRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const roomTypeChartRef = useRef<HTMLCanvasElement>(null)
  const weeklyChartInstance = useRef<Chart | null>(null)
  const channelChartInstances = useRef<(Chart | null)[]>([])
  const roomTypeChartInstance = useRef<Chart | null>(null)

  // 동기화 시간: 초기 로드 시 1회
  useEffect(() => {
    fetchLastSyncTime()
  }, [])

  // 일 실적: 지점, 날짜 변경 시만
  useEffect(() => {
    fetchDailyData()
  }, [selectedBranch, selectedDate])

  // 월 실적: 지점, 월 변경 시만
  useEffect(() => {
    fetchMonthlyData()
    fetchMonthlySummary()
  }, [selectedBranch, selectedMonth])

  // 주간 실적 + 채널 비중: 지점, 주차 변경 시만
  useEffect(() => {
    fetchWeeklyAndChannelData()
  }, [selectedBranch, currentWeek])

  // 탑라인: 지점, 탑라인 월 변경 시만
  useEffect(() => {
    fetchToplineData()
  }, [selectedBranch, toplineMonth])

  useEffect(() => {
    if (weeklyData) {
      renderWeeklyChart()
    }
    return () => {
      weeklyChartInstance.current?.destroy()
    }
  }, [weeklyData])

  useEffect(() => {
    if (channelData?.days) {
      renderChannelCharts()
    }
    return () => {
      channelChartInstances.current.forEach(c => c?.destroy())
      channelChartInstances.current = []
    }
  }, [channelData])

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
      // 첫 로드 시 룸타입 미선택이면 첫 번째 룸타입 자동 선택
      if (!selectedRoomType && data.roomTypes?.length > 0) {
        setSelectedRoomType(data.roomTypes[0])
        return // setSelectedRoomType이 useEffect를 다시 트리거
      }
      setRoomTypeData(data)
    } catch (error) {
      console.error('룸타입 데이터 로드 실패:', error)
    }
  }

  const fetchMonthlySummary = async () => {
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const response = await fetch(
        `/api/monthly-summary?branch=${branch}&month=${selectedMonth}`
      )
      const data = await response.json()
      setMonthlySummaryData(data)
    } catch (error) {
      console.error('월별 요약 데이터 로드 실패:', error)
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

  const fetchLastSyncTime = async () => {
    try {
      const data = await fetch('/api/sync-status').then(r => r.json())
      if (data.last_synced) setLastUpdated(data.last_synced)
    } catch {}
  }

  const fetchDailyData = async () => {
    setLoading(true)
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const dateParam = selectedDate ? `&date=${selectedDate}` : ''
      const currentDate = selectedDate ? new Date(selectedDate) : new Date()
      const prevDate = new Date(currentDate)
      prevDate.setDate(currentDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      const [daily, prevDaily] = await Promise.all([
        fetch(`/api/daily?branch=${branch}${dateParam}`).then(r => r.json()),
        fetch(`/api/daily?branch=${branch}&date=${prevDateStr}`).then(r => r.json()),
      ])
      setDailyData(daily)
      setPrevDailyData(prevDaily)
    } catch (error) {
      console.error('일 실적 로드 실패:', error)
    } finally {
      setLoading(false)
      fetchLastSyncTime()
    }
  }

  const fetchMonthlyData = async () => {
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const data = await fetch(`/api/monthly?branch=${branch}&month=${selectedMonth}`).then(r => r.json())
      setMonthlyData(data)
    } catch (error) {
      console.error('월 실적 로드 실패:', error)
    }
  }

  const fetchWeeklyAndChannelData = async () => {
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const wr = getWeekRange(currentWeek)
      const weekStartStr = wr.start.toISOString().split('T')[0]
      const weekEndStr = wr.end.toISOString().split('T')[0]
      const prevWr = getWeekRange(currentWeek - 1)
      const prevWeekStartStr = prevWr.start.toISOString().split('T')[0]
      const prevWeekEndStr = prevWr.end.toISOString().split('T')[0]

      const [weekly, prevWeekly, channel] = await Promise.all([
        fetch(`/api/weekly?branch=${branch}&startDate=${weekStartStr}&endDate=${weekEndStr}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${branch}&startDate=${prevWeekStartStr}&endDate=${prevWeekEndStr}`).then(r => r.json()),
        fetch(`/api/channel-breakdown?branch=${branch}&startDate=${weekStartStr}&endDate=${weekEndStr}`).then(r => r.json()),
      ])
      setWeeklyData(weekly)
      setPrevWeeklyData(prevWeekly)
      setChannelData(channel)
    } catch (error) {
      console.error('주간 실적 로드 실패:', error)
    }
  }

  const fetchToplineData = async () => {
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const data = await fetch(`/api/topline?branch=${branch}&month=${toplineMonth}`).then(r => r.json())
      setToplineData(data)
    } catch (error) {
      console.error('탑라인 로드 실패:', error)
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

  const renderChannelCharts = () => {
    if (!channelData?.days) return

    channelChartInstances.current.forEach(c => c?.destroy())
    channelChartInstances.current = []

    channelData.days.forEach((day: any, i: number) => {
      const canvas = channelChartRefs.current[i]
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const channels = day.channels.filter((c: any) => c.ratio >= 1)
      if (channels.length === 0) return

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: channels.map((c: any) => c.channel),
          datasets: [{
            data: channels.map((c: any) => c.amount),
            backgroundColor: channels.map((c: any) => c.color),
            borderWidth: 1.5,
            borderColor: '#fff',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '55%',
          plugins: {
            datalabels: {
              color: '#374151',
              font: { size: 9, weight: 'bold' },
              formatter: (value: any, context: any) => {
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
                const pct = ((value / total) * 100).toFixed(0)
                return Number(pct) >= 10 ? `${pct}%` : ''
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const ch = channels[ctx.dataIndex]
                  const adr = new Intl.NumberFormat('ko-KR').format(ch.adr || 0)
                  const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0)
                  const pct = ((ctx.parsed / total) * 100).toFixed(1)
                  return `${ctx.label}: ADR ${adr}원 (${ch.count}건, ${pct}%)`
                }
              }
            },
            legend: { display: false }
          }
        }
      })

      channelChartInstances.current.push(chart as any)
    })
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

    // OTA/LoS 데이터 유무 확인
    const hasOtaData = roomTypeData.days.some((d: any) => d.channel_ratios && Object.keys(d.channel_ratios).length > 0)
    const hasLosData = roomTypeData.days.some((d: any) => d.avg_los > 0)

    const datasets: any[] = [
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
      },
      {
        label: 'ADR',
        data: roomTypeData.days.map((d: any) => d.adr || null),
        type: 'line',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        pointRadius: 3,
        yAxisID: 'y1',
        order: 0
      },
    ]

    if (hasOtaData) {
      datasets.push({
        label: 'OTA 비율',
        data: roomTypeData.days.map((d: any) => {
          const otaRatio = d.channel_ratios?.['OTA'] || 0
          return otaRatio / 100
        }),
        backgroundColor: 'rgba(236, 72, 153, 0.7)',
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 2,
        yAxisID: 'y',
        order: 4
      })
    }

    if (hasLosData) {
      datasets.push({
        label: 'LoS (평균 숙박)',
        data: roomTypeData.days.map((d: any) => d.avg_los || null),
        type: 'line',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        pointRadius: 4,
        yAxisID: 'y2',
        borderDash: [3, 3],
        datalabels: {
          display: true,
          color: 'rgba(139, 92, 246, 1)',
          align: 'top',
          offset: 8,
          font: { size: 11, weight: 'bold' },
          formatter: (value: any) => {
            return value > 0 ? value.toFixed(1) + '박' : ''
          }
        },
        order: 0
      })
    }

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25 } },
        plugins: {
          legend: { position: 'bottom' },
          datalabels: {
            display: true,
            color: '#000',
            anchor: 'end',
            align: 'top',
            formatter: (value: any, context: any) => {
              // LoS 표시 (OCC 막대 위에)
              if (context.dataset.label === 'OCC') {
                const los = roomTypeData.days[context.dataIndex]?.avg_los || 0
                const occPct = (value * 100).toFixed(0)
                return los > 0 ? `${occPct}%\n${los.toFixed(1)}박` : `${occPct}%`
              }
              
              if (context.dataset.yAxisID === 'y') {
                return (value * 100).toFixed(0) + '%'
              } else {
                return new Intl.NumberFormat('ko-KR').format(value)
              }
            },
            font: { size: 10 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || ''
                if (label) label += ': '
                
                const value = context.parsed.y
                if (value === null || value === undefined) return label + 'N/A'
                
                if (context.dataset.yAxisID === 'y') {
                  label += (value * 100).toFixed(1) + '%'
                } else {
                  label += new Intl.NumberFormat('ko-KR').format(value)
                }
                return label
              },
              afterBody: function(tooltipItems) {
                if (tooltipItems.length === 0) return ''
                
                const dataIndex = tooltipItems[0].dataIndex
                const dayData = roomTypeData.days[dataIndex]
                
                let result = []
                
                // LoS 추가
                if (dayData.avg_los > 0) {
                  result.push(`\n평균 숙박: ${dayData.avg_los.toFixed(1)}박`)
                }
                
                // 채널 비중 추가
                if (dayData.channel_ratios && Object.keys(dayData.channel_ratios).length > 0) {
                  result.push('\n\n📊 채널별 비중:')
                  Object.entries(dayData.channel_ratios)
                    .sort((a: any, b: any) => b[1] - a[1])
                    .forEach(([ch, ratio]: any) => {
                      result.push(`${ch}: ${ratio.toFixed(1)}%`)
                    })
                }
                
                return result.join('\n')
              }
            }
          }
        },
        scales: {
          y: {
            position: 'left',
            title: { display: true, text: 'OCC (%)' },
            min: 0,
            max: 1.15,
            ticks: {
              callback: (v) => {
                const n = v as number
                return n <= 1 ? (n * 100).toFixed(0) + '%' : ''
              },
              stepSize: 0.2
            }
          },
          y1: {
            position: 'right',
            title: { display: true, text: '가격 (원)' },
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => new Intl.NumberFormat('ko-KR').format(v as number) }
          },
          ...(hasLosData ? { y2: {
            position: 'right',
            title: { display: true, text: 'LoS (박)' },
            min: 0,
            max: 5,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (v) => ((v as number).toFixed(1)) + '박',
              stepSize: 1
            }
          }} : {})
        }
      }
    }

    roomTypeChartInstance.current = new Chart(ctx, config)
  }

  const roomTypes = roomTypeData?.roomTypes || []
  
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📊 M1버프 현황판</h1>
              <p className="text-sm text-gray-500 mt-1">데이터 동기화{lastUpdated && <span className="ml-2 text-gray-400">| {lastUpdated} 기준</span>}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/daily-issues"
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                🔥 일간 이슈
              </a>
              <a
                href="/weekly-reviews"
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                📊 주간 리뷰
              </a>
              <a
                href="https://test-omega-rouge-35.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                리드타임별 예약점유율 데이터 →
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* 지점 필터 */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
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
                {week.avg_occ > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-gray-400 mb-1">잔여 {(week.total_available - week.total_sold).toLocaleString('ko-KR')}실</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left font-normal"></th>
                          <th className="text-right font-normal">평일</th>
                          <th className="text-right font-normal">주말</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-gray-500 py-0.5">OCC</td>
                          <td className={`text-right font-semibold ${week.weekday_occ >= 80 ? 'text-red-600' : week.weekday_occ >= 60 ? 'text-orange-600' : 'text-green-600'}`}>
                            {week.weekday_occ?.toFixed(1)}%
                          </td>
                          <td className={`text-right font-semibold ${week.weekend_occ >= 80 ? 'text-red-600' : week.weekend_occ >= 60 ? 'text-orange-600' : 'text-green-600'}`}>
                            {week.weekend_occ?.toFixed(1)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 py-0.5">ADR</td>
                          <td className="text-right font-semibold text-gray-700">
                            {(week.weekday_adr || 0).toLocaleString('ko-KR')}
                          </td>
                          <td className="text-right font-semibold text-gray-700">
                            {(week.weekend_adr || 0).toLocaleString('ko-KR')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                {week.pickup_top5?.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-gray-400 mb-1">픽업 시점</div>
                    <div className="space-y-0.5">
                      {week.pickup_top5.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-500">{p.week}</span>
                          <span className="font-semibold text-gray-700">{p.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
          {/* 전일 실적 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[{prevDailyData?.date ? new Date(prevDailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] 픽업매출</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevDailyData?.pickup?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[{prevDailyData?.date ? new Date(prevDailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {prevDailyData?.month1 || ''}월 C/I 매출</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevDailyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[{prevDailyData?.date ? new Date(prevDailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {prevDailyData?.month2 || ''}월 C/I 매출</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevDailyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[{prevDailyData?.date ? new Date(prevDailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {prevDailyData?.month3 || ''}월 C/I 매출</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevDailyData?.month3_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
          </div>
          {/* 당일 실적 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] 픽업매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.pickup?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.pickup_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.pickup_dod || 0) >= 0 ? '+' : ''}{(dailyData?.pickup_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month1 || ''}월 C/I 매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month1_ci_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.month1_ci_dod || 0) >= 0 ? '+' : ''}{(dailyData?.month1_ci_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month2 || ''}월 C/I 매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month2_ci_dod || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DoD {(dailyData?.month2_ci_dod || 0) >= 0 ? '+' : ''}{(dailyData?.month2_ci_dod || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month3 || ''}월 C/I 매출</span>
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
              <span className="text-sm font-medium min-w-[120px] text-center">
                {weekRange.label}
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
          {/* 전주 실적 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[전주] 픽업매출</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevWeeklyData?.total_pickup?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[전주] {prevWeeklyData?.month1 || ''}월 C/I</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevWeeklyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[전주] {prevWeeklyData?.month2 || ''}월 C/I</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevWeeklyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <span className="text-xs font-medium text-gray-500">[전주] {prevWeeklyData?.month3 || ''}월 C/I</span>
              <div className="text-xl font-bold text-gray-700 mt-1">
                {prevWeeklyData?.month3_ci?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
          </div>
          {/* 이번주 실적 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{weekRange.label}] 픽업매출</span>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">최근 일주일 매출 추이</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(currentWeek - 1)}
                className="p-2 hover:bg-gray-100 rounded-lg border"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {weekRange.label}
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
          <div className="h-80">
            <canvas ref={weeklyChartRef}></canvas>
          </div>
        </div>

        {/* 일간 채널별 픽업 매출 비중 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">일간 채널별 픽업 매출 비중</h2>
              <p className="text-sm text-gray-500 mt-1">
                {weekRange.label} | 총 {channelData?.totalAmount?.toLocaleString('ko-KR') || 0}원 ({channelData?.totalBookings?.toLocaleString('ko-KR') || 0}건)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentWeek(currentWeek - 1)} className="p-2 hover:bg-gray-100 rounded-lg border">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-medium min-w-[120px] text-center">{weekRange.label}</span>
              <button onClick={() => setCurrentWeek(currentWeek + 1)} className="p-2 hover:bg-gray-100 rounded-lg border">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          {/* 범례 */}
          {channelData?.channels && (
            <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b">
              {channelData.channels.map((c: any) => (
                <div key={c.channel} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }}></span>
                  {c.channel} ({c.ratio.toFixed(0)}%)
                </div>
              ))}
            </div>
          )}
          {/* 7개 미니 도넛 */}
          <div className="grid grid-cols-7 gap-3">
            {channelData?.days?.map((day: any, i: number) => {
              const date = new Date(day.date)
              const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
              const isWeekend = date.getDay() === 5 || date.getDay() === 6
              return (
                <div key={day.date} className={`text-center ${isWeekend ? 'bg-blue-50' : 'bg-gray-50'} rounded-lg p-2`}>
                  <div className={`text-xs font-medium ${isWeekend ? 'text-blue-600' : 'text-gray-500'}`}>
                    {date.getMonth() + 1}/{date.getDate()} ({dayName})
                  </div>
                  <div className="h-28 my-1">
                    <canvas ref={el => { channelChartRefs.current[i] = el }}></canvas>
                  </div>
                  <div className="text-xs font-semibold text-gray-700">
                    {(day.total / 10000).toFixed(0)}만
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {day.channels?.[0]?.channel} {day.channels?.[0]?.ratio?.toFixed(0)}%
                  </div>
                </div>
              )
            })}
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
                  {roomTypes.map((rt: string) => {
                    const roomCount = ROOM_COUNTS[selectedBranch]?.[rt]
                    const displayText = roomCount ? `${rt} (${roomCount})` : rt
                    return (
                      <button
                        key={rt}
                        onClick={() => setSelectedRoomType(rt)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                          selectedRoomType === rt
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600'
                        }`}
                      >
                        {displayText}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="h-96">
            <canvas ref={roomTypeChartRef}></canvas>
          </div>
        </div>

      </main>
    </div>
  )
}
