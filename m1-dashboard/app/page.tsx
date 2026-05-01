'use client'

import { useEffect, useState, useRef } from 'react'
import { Chart, ChartConfiguration, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { ROOM_COUNTS } from '@/lib/pricing-engine'

Chart.register(...registerables, ChartDataLabels)

const BRANCHES = [
  '전지점', '가평오버더마운틴', '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
  '당진터미널점', '호텔 동탄', '명동점', '부산기장점', '부산송도해변점',
  '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
  '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
  '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
  '웨이브파크점', '인천차이나타운', '제주공항점', '플라트더각양양',
  '해운대역', '해운대패러그라프점'
]


export default function Dashboard() {
  const [dailyData, setDailyData] = useState<any>(null)
  const [prevDailyData, setPrevDailyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [prevWeeklyData, setPrevWeeklyData] = useState<any>(null)
  const [toplineData, setToplineData] = useState<any>(null)
  const toplineCache = useRef<Record<string, any>>({})
  const [roomTypeData, setRoomTypeData] = useState<any>(null)
  const [monthlySummaryData, setMonthlySummaryData] = useState<any>(null)
  const [channelData, setChannelData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toplineLoading, setToplineLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [selectedBranch, setSelectedBranch] = useState('전지점') // 디폴트 전지점
  const [selectedRoomType, setSelectedRoomType] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [toplineMonth, setToplineMonth] = useState(new Date().getMonth() + 1) // Topline 월 필터 (현재 월)
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

  // ★ 탑라인 최우선 로딩 → 완료 후 나머지 lazy load
  useEffect(() => {
    const controller = new AbortController()
    fetchToplineData(controller.signal).then(() => {
      // 탑라인 완료 후 나머지 로딩
      fetchDailyData()
      fetchMonthlyData()
      fetchMonthlySummary()
      fetchWeeklyAndChannelData()
    })
    return () => controller.abort()
  }, [selectedBranch])

  // 일 실적: 날짜 변경 시만 (지점 변경은 위에서 처리)
  useEffect(() => {
    if (!selectedDate) return
    fetchDailyData()
  }, [selectedDate])

  // 월 실적: 월 변경 시만
  useEffect(() => {
    fetchMonthlyData()
    fetchMonthlySummary()
  }, [selectedMonth])

  // 주간 실적 + 채널 비중: 주차 변경 시만
  useEffect(() => {
    fetchWeeklyAndChannelData()
  }, [currentWeek])

  // 탑라인: 월 변경 시
  useEffect(() => {
    const controller = new AbortController()
    fetchToplineData(controller.signal)
    return () => controller.abort()
  }, [toplineMonth])

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
      const branch_param = branch === 'all' ? '' : branch
      if (!branch_param) { setRoomTypeData(null); return }
      const response = await fetch(
        `/api/roomtype?branch=${branch_param}&weekOffset=${roomTypeWeekOffset}&roomType=${selectedRoomType}`
      )
      if (!response.ok) { setRoomTypeData(null); return }
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

  const fetchDailyData = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const dateParam = selectedDate ? `&date=${selectedDate}` : ''
      const currentDate = selectedDate ? new Date(selectedDate) : new Date()
      const prevDate = new Date(currentDate)
      prevDate.setDate(currentDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      const [daily, prevDaily] = await Promise.all([
        fetch(`/api/daily?branch=${branch}${dateParam}`, { signal }).then(r => r.json()),
        fetch(`/api/daily?branch=${branch}&date=${prevDateStr}`, { signal }).then(r => r.json()),
      ])
      if (!signal?.aborted) {
        setDailyData(daily)
        setPrevDailyData(prevDaily)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('일 실적 로드 실패:', error)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        fetchLastSyncTime()
      }
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

  const fetchToplineData = async (signal?: AbortSignal) => {
    const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
    const cacheKey = `${branch}:${toplineMonth}`

    // 캐시 히트 → 즉시 표시
    if (toplineCache.current[cacheKey]) {
      setToplineData(toplineCache.current[cacheKey])
      return
    }

    setToplineLoading(true)
    try {
      const data = await fetch(`/api/topline?branch=${branch}&month=${toplineMonth}`, { signal }).then(r => r.json())
      if (!signal?.aborted) {
        toplineCache.current[cacheKey] = data
        setToplineData(data)

        // 인접 월 백그라운드 프리페치 (±1)
        const adjacent = [toplineMonth - 1, toplineMonth + 1].filter(m => m >= 1 && m <= 12)
        adjacent.forEach(m => {
          const adjKey = `${branch}:${m}`
          if (!toplineCache.current[adjKey]) {
            fetch(`/api/topline?branch=${branch}&month=${m}`)
              .then(r => r.json())
              .then(d => { toplineCache.current[adjKey] = d })
              .catch(() => {})
          }
        })
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('탑라인 로드 실패:', error)
    } finally {
      if (!signal?.aborted) setToplineLoading(false)
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
                  const pct = ((ctx.parsed / total) * 100).toFixed(0)
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
        label: '노출가',
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
                  label += (value * 100).toFixed(0) + '%'
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
                      result.push(`${ch}: ${ratio.toFixed(0)}%`)
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
                onClick={() => { toplineCache.current = {}; setSelectedBranch(branch) }}
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
          <div className="flex items-baseline gap-4 mb-3">
            <span className="text-lg font-bold text-gray-900">{toplineData?.month || ''}월 C/I {toplineData?.total_ci?.toLocaleString('ko-KR') || 0}원</span>
            {toplineData?.total_target > 0 && (
              <span className="text-sm text-gray-500">
                목표 {toplineData?.total_target?.toLocaleString('ko-KR')}
                <span className={`ml-1 font-semibold ${(toplineData?.achievement_rate || 0) >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                  ({(toplineData?.achievement_rate || 0).toFixed(0)}%)
                </span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {toplineData?.weeks?.map((week: any) => (
              <div key={week.week_num} className="bg-white p-6 rounded-lg shadow-sm border">
                <span className="text-sm font-medium text-gray-600">W{week.week_num} ({week.label})</span>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {week.ci_amount?.toLocaleString('ko-KR') || 0}
                </div>
                {(week.avg_occ > 0 || week.weekday_adr > 0 || week.weekend_adr > 0) && (
                  <div className="mt-2 pt-2 border-t">
                    {week.total_available > 0 && <div className="text-xs text-gray-400 mb-1">잔여 {(week.total_available - week.total_sold).toLocaleString('ko-KR')}실</div>}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left font-normal"></th>
                          <th className="text-right font-normal">평일({week.weekday_days})</th>
                          <th className="text-right font-normal">주말({week.weekend_days})</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="text-gray-500 py-0.5">OCC</td>
                          <td className={`text-right font-semibold ${week.weekday_occ >= 80 ? 'text-red-600' : week.weekday_occ >= 60 ? 'text-orange-600' : 'text-green-600'}`}>
                            {week.weekday_occ?.toFixed(0)}%
                          </td>
                          <td className={`text-right font-semibold ${week.weekend_occ >= 80 ? 'text-red-600' : week.weekend_occ >= 60 ? 'text-orange-600' : 'text-green-600'}`}>
                            {week.weekend_occ?.toFixed(0)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 py-0.5">ADR</td>
                          <td className="text-right font-semibold text-gray-700">
                            {(week.weekday_adr || 0).toLocaleString('ko-KR')}
                            {week.weekday_adr_yoy != null && (
                              <span className={`ml-0.5 text-[10px] font-medium ${week.weekday_adr_yoy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {week.weekday_adr_yoy >= 0 ? '▲' : '▼'}{Math.abs(week.weekday_adr_yoy)}%
                              </span>
                            )}
                          </td>
                          <td className="text-right font-semibold text-gray-700">
                            {(week.weekend_adr || 0).toLocaleString('ko-KR')}
                            {week.weekend_adr_yoy != null && (
                              <span className={`ml-0.5 text-[10px] font-medium ${week.weekend_adr_yoy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {week.weekend_adr_yoy >= 0 ? '▲' : '▼'}{Math.abs(week.weekend_adr_yoy)}%
                              </span>
                            )}
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
                          <span className="text-gray-700">
                            <span className="font-semibold">{p.pct}%</span>
                            {p.adr > 0 && <span className="text-gray-400 ml-1">({(p.adr/10000).toFixed(1)}만)</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {week.channel_dist?.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-gray-400 mb-1">채널</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {week.channel_dist.map((c: any, i: number) => (
                        <span key={i} className="text-xs">
                          <span className="text-gray-500">{c.channel}{c.los > 0 && <span className="text-gray-500 ml-0.5">{c.los}박</span>}</span>
                          <span className="font-semibold text-gray-700 ml-1">{c.pct}%</span>
                          {c.adr > 0 && (
                            <span className="text-gray-400 ml-0.5">
                              ({(c.adr/10000).toFixed(1)}만{c.adr_yoy != null && (
                                <span className={`ml-0.5 ${c.adr_yoy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {c.adr_yoy >= 0 ? '▲' : '▼'}{Math.abs(c.adr_yoy)}%
                                </span>
                              )})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 픽업 기준 탑라인 — 삭제됨 (코호트로 대체) */}
        </div>

        {/* 픽업 코호트 */}
        <PickupCohort branch={selectedBranch} toplineMonth={toplineMonth} />

        {/* 일 실적 — REMOVED, 코호트로 대체 */}
        {false && <div className="mb-6">
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
              <div className={`text-sm mt-1 ${(dailyData?.pickup_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                전주 동요일 {(dailyData?.pickup_wow || 0) >= 0 ? '+' : ''}{(dailyData?.pickup_wow || 0).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month1 || ''}월 C/I 매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month1_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month1_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                전주 동요일 {(dailyData?.month1_ci_wow || 0) >= 0 ? '+' : ''}{(dailyData?.month1_ci_wow || 0).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month2 || ''}월 C/I 매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month2_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month2_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                전주 동요일 {(dailyData?.month2_ci_wow || 0) >= 0 ? '+' : ''}{(dailyData?.month2_ci_wow || 0).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <span className="text-sm font-medium text-gray-600">[{dailyData?.date ? new Date(dailyData.date).toLocaleDateString('ko-KR', {month: 'short', day: 'numeric'}) : '-'}] {dailyData?.month3 || ''}월 C/I 매출</span>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {dailyData?.month3_ci?.toLocaleString('ko-KR') || 0}
              </div>
              <div className={`text-sm mt-1 ${(dailyData?.month3_ci_wow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                전주 동요일 {(dailyData?.month3_ci_wow || 0) >= 0 ? '+' : ''}{(dailyData?.month3_ci_wow || 0).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        }
        {/* 목표 달성 현황 */}
        <AchievementSection branch={selectedBranch} toplineMonth={toplineMonth} />


      </main>
    </div>
  )
}

// ── 목표 달성 현황 컴포넌트 ──
function AchievementSection({ branch, toplineMonth }: { branch: string; toplineMonth: number }) {
  const [data, setData] = useState<any>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)

  const branchParam = branch === '전지점' ? 'all' : branch

  const [achLoading, setAchLoading] = useState(true)

  useEffect(() => {
    setAchLoading(true)
    fetch(`/api/achievement?branch=${encodeURIComponent(branchParam)}&month=${toplineMonth}`)
      .then(r => r.json())
      .then(d => { setData(d); setAchLoading(false) })
      .catch(() => setAchLoading(false))
  }, [branchParam, toplineMonth])

  // 개별 지점: 차트 렌더
  useEffect(() => {
    if (!data || data.type !== 'branch' || !chartRef.current) return
    chartInstance.current?.destroy()

    const days = data.days || []
    const labels = days.map((d: any) => {
      const dt = new Date(d.date)
      return `${dt.getMonth()+1}/${dt.getDate()}`
    })

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '일매출',
            data: days.map((d: any) => d.daily),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: '달성률',
            data: days.map((d: any) => d.rate),
            borderColor: '#10B981',
            backgroundColor: '#10B981',
            tension: 0.3,
            yAxisID: 'y1',
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === '달성률') return `${(ctx.parsed.y ?? 0)}%`
                return `${((ctx.parsed.y ?? 0) / 1e6).toFixed(0)}백만`
              }
            }
          }
        },
        scales: {
          y: { position: 'left', title: { display: true, text: '일매출' }, ticks: { callback: (v) => `${(Number(v)/1e6).toFixed(0)}M` } },
          y1: { position: 'right', title: { display: true, text: '달성률 (%)' }, min: 0, grid: { drawOnChartArea: false } },
        }
      }
    })

    return () => { chartInstance.current?.destroy() }
  }, [data])

  if (achLoading) return <div className="mb-6 p-4 text-gray-400 text-sm">목표 달성 현황 로딩 중...</div>
  if (!data) return <div className="mb-6 p-4 text-red-400 text-sm">목표 달성 데이터 없음</div>

  // 전지점: 테이블
  if (data.type === 'all') {
    const sorted = [...(data.branches || [])].sort((a: any, b: any) => b.rate - a.rate)
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
          {toplineMonth}월 지점별 목표 달성 현황
        </h2>
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-2">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold">{data.total.rate}% 달성</span>
            <span className="text-sm text-gray-500">
              {data.total.revenue.toLocaleString('ko-KR')}원 / {data.total.target.toLocaleString('ko-KR')}원
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${Math.min(data.total.rate, 100)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {sorted.map((b: any) => (
            <div key={b.branch} className="bg-white rounded border px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium w-40 truncate">{b.branch}</span>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${b.rate >= 100 ? 'bg-green-500' : b.rate >= 80 ? 'bg-blue-500' : b.rate >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(b.rate, 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-bold w-16 text-right ${b.rate >= 100 ? 'text-green-600' : b.rate >= 80 ? 'text-blue-600' : 'text-gray-600'}`}>
                {b.rate}%
              </span>
              <span className="text-xs text-gray-400 w-24 text-right">
                {b.revenue.toLocaleString('ko-KR')} / {b.target.toLocaleString('ko-KR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 개별 지점: 차트
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
        {branch} {toplineMonth}월 목표 달성 추이
        <span className="ml-2 text-xs text-gray-400">
          목표 {data.target ? `${data.target.toLocaleString('ko-KR')}원` : '-'}
          {data.days?.length > 0 && ` | 현재 ${data.days[data.days.length - 1].rate}%`}
        </span>
      </h2>
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="h-72">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  )
}

// ── 픽업 코호트 ──
function PickupCohort({ branch, toplineMonth }: { branch: string; toplineMonth: number }) {
  const [data, setData] = useState<any>(null)
  const [channelFilter, setChannelFilter] = useState<'all' | 'ota'>('all')
  const branchParam = branch === '전지점' ? 'all' : branch

  useEffect(() => {
    fetch(`/api/pickup-cohort?branch=${encodeURIComponent(branchParam)}&month=${toplineMonth}&channel=${channelFilter}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [branchParam, toplineMonth, channelFilter])

  if (!data || !data.rows?.length) return null

  const weeks: string[] = data.weeks || []
  const rows: { date: string; total: number; cells: number[] }[] = data.rows || []

  // 히트맵 색상: 값 크기에 따라
  const allValues = rows.flatMap(r => r.cells).filter(v => v > 0)
  const maxVal = Math.max(...allValues, 1)

  const cellColor = (v: number) => {
    if (v === 0) return ''
    const intensity = Math.min(v / maxVal, 1)
    const alpha = 0.1 + intensity * 0.6
    return `rgba(34, 139, 34, ${alpha})`
  }

  const fmt = (v: number) => {
    if (v === 0) return ''
    return v.toLocaleString('ko-KR')
  }

  const dow = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">
          {toplineMonth}월 픽업 코호트
          <span className="ml-2 text-xs text-gray-400 font-normal">예약일(행) × 체크인 주차(열)</span>
        </h2>
        <div className="flex gap-1">
          {(['all', 'ota'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1 text-xs font-medium rounded-lg ${
                channelFilter === ch ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {ch === 'all' ? '전체채널' : 'OTA'}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-2 py-1.5 text-left font-medium text-gray-500 border-r">예약일</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-500 border-r">총합계</th>
              {weeks.map(w => (
                <th key={w} className="px-2 py-1.5 text-right font-medium text-gray-500 whitespace-nowrap">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const d = new Date(row.date)
              const dayLabel = `${d.getMonth()+1}/${d.getDate()}(${dow[d.getDay()]})`
              return (
                <tr key={row.date} className="border-t hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-2 py-1 font-medium text-gray-700 border-r whitespace-nowrap">{dayLabel}</td>
                  <td className="px-2 py-1 text-right font-semibold text-gray-800 border-r">{fmt(row.total)}</td>
                  {row.cells.map((v, i) => (
                    <td key={i} className="px-2 py-1 text-right text-gray-700" style={{ backgroundColor: cellColor(v) }}>
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
