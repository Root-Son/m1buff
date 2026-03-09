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

// 지점별 룸타입별 보유 객실수
const ROOM_COUNTS: Record<string, Record<string, number>> = {
  "강남예전로이움점": { "스튜디오": 30, "스튜디오 랜덤": 17, "스튜디오 베리어프리": 1, "패밀리 투룸": 24, "프리미어 스위트": 11 },
  "강남예전시그니티점": { "스튜디오": 8, "패밀리 투룸": 5, "프리미어 스위트 (욕조)": 3, "프리미어 스위트 W": 42, "프리미어 스위트 랜덤": 18, "프리미어 스위트 패밀리": 7 },
  "거북섬점": { "스튜디오": 39, "스튜디오 랜덤": 21, "스튜디오 시티": 36, "스튜디오 트윈": 43, "스튜디오_배리어프리": 2, "프리미어 스위트": 7 },
  "낙산해변": { "스튜디오": 8, "스튜디오 설악": 21, "스튜디오 패밀리": 13, "스튜디오 패밀리 파셜 오션": 17, "프리미어 스위트 오션": 4 },
  "당진터미널점": { "스튜디오": 105, "스튜디오 로프트": 35, "스튜디오 싱글": 4, "스튜디오 트윈": 33 },
  "동탄점(호텔)": { "스탠다드": 23, "스탠다드 배리어프리": 3, "스탠다드 트윈": 22, "스탠다드(욕조)": 23 },
  "명동점": { "스튜디오": 25, "스튜디오 시티": 24, "스튜디오 테라스": 2, "스튜디오 파노라마": 3 },
  "부산기장점": { "패밀리 쓰리룸": 12, "패밀리 쓰리룸 오션": 7, "패밀리 투룸": 34, "패밀리 투룸 오션": 7 },
  "부산송도해변점": { "스튜디오": 20, "스튜디오 스위트 W 오션": 4, "스튜디오 오션": 51, "스튜디오 트윈": 21, "스튜디오 트윈 오션": 3, "스튜디오 패밀리": 39, "스튜디오 패밀리 오션": 16, "스튜디오_배리어프리": 3, "패밀리 투룸 오션": 1 },
  "부산시청점": { "스튜디오": 14, "스튜디오 W": 8, "스튜디오 랜덤": 23, "스튜디오 비즈니스": 4, "스튜디오 시티": 22 },
  "부산역점": { "패밀리 쓰리룸 G": 7, "패밀리 쓰리룸 G 트리플": 1, "패밀리 쓰리룸 G 파노라마": 2, "패밀리 투룸 G": 4, "프리미어 스위트 G 커넥팅": 14, "프리미어 스위트 W": 11 },
  "부티크남포BIFF점": { "가든 테라스": 1, "스튜디오": 21, "스튜디오 랜덤": 12, "스튜디오 시티": 26, "스튜디오 하버오션": 16 },
  "부티크익선점": { "스튜디오": 16, "스튜디오 시티": 16, "스튜디오 트윈": 8, "스튜디오 파노라마": 6, "패밀리 투룸": 8 },
  "서면점": { "스튜디오": 125, "스튜디오 랜덤": 32, "스튜디오 시티": 45, "스튜디오 싱글": 32, "스튜디오 트윈": 36 },
  "속초등대해변점": { "스튜디오": 117, "스튜디오 W": 20, "스튜디오 랜덤": 68, "스튜디오 시티오션": 3, "스튜디오 패밀리": 13, "스튜디오 풀오션": 32 },
  "속초자이엘라더비치": { "스튜디오": 35, "스튜디오 배리어프리": 3, "스튜디오 와이드 랜덤": 121, "스튜디오 와이드 오션": 39, "스튜디오 와이드(B)": 10, "스튜디오 트윈": 17, "스튜디오 프라이빗 스파": 4, "패밀리 투룸 오션": 4, "패밀리 투룸 파노라마 오션": 3, "프리미어 스위트": 4, "프리미어 스위트 오션": 9 },
  "속초중앙점": { "스튜디오": 49, "스튜디오 랜덤": 36, "스튜디오 배리어프리": 6, "스튜디오 패밀리": 58, "패밀리 로프트 투룸": 1, "패밀리 쓰리룸": 8, "패밀리 와이드 로프트 투룸": 1, "패밀리 와이드 투룸": 10, "패밀리 와이드 투룸 A": 3, "패밀리 투룸": 34, "펜트하우스": 2 },
  "속초해변": { "스튜디오": 11, "스튜디오 오션": 27, "스튜디오 트윈": 26, "스튜디오 파셜오션": 47, "패밀리 투룸": 3, "패밀리 투룸 오션": 8, "프리미어 스위트 오션": 3 },
  "속초해변 AB점": { "스튜디오": 60, "스튜디오 가든": 45, "스튜디오 랜덤": 59, "스튜디오 트윈": 3, "스튜디오 패밀리": 33, "프리미어 스위트": 1 },
  "속초해변C점": { "스튜디오": 25, "스튜디오 파셜 오션": 15, "패밀리 투룸 오션": 7, "프리미어 스위트 오션": 21, "프리미어 스위트 코너": 6 },
  "송도달빛공원점": { "스튜디오": 40, "스튜디오 W": 7, "스튜디오 랜덤": 12, "스튜디오 비즈니스": 34, "스튜디오 시티": 41, "패밀리 투룸": 1, "프리미어 스위트": 9 },
  "스타즈울산점": { "디럭스 패밀리 트윈": 24, "스위트": 5, "스탠다드 더블": 150, "스탠다드 싱글": 34, "스탠다드 트윈": 96, "스탠다드더블_배리어프리": 2, "이그제큐티브 더블": 10, "주니어 스위트": 6 },
  "웨이브파크점": { "스튜디오": 37, "스튜디오 로프트": 41, "스튜디오 로프트 서프": 32, "스튜디오 로프트 트윈": 32, "스튜디오 로프트 파셜 오션": 22, "스튜디오 로프트 패밀리": 40, "패밀리 투룸 오션": 13, "프리미어 스위트 패밀리": 53 },
  "인천차이나타운": { "스튜디오 (B)": 35, "스튜디오 W": 1, "스튜디오 랜덤": 4, "스튜디오 트윈": 44, "스튜디오 하버오션": 20, "스튜디오_배리어프리": 1, "패밀리 쓰리룸": 6, "패밀리 투룸": 14 },
  "제주공항점": { "스튜디오": 42, "스튜디오 W": 9, "스튜디오 싱글": 9, "프리미어 스위트": 7 },
  "해운대역": { "스튜디오": 16, "스튜디오 랜덤": 15, "스튜디오 트윈": 14, "프리미어 스위트": 23, "프리미어 스위트 오션": 6, "프리미어 스위트 트윈": 16, "프리미어 스위트 패밀리": 13, "프리미어 스위트 패밀리 오션": 12 },
  "해운대패러그라프점": { "스튜디오": 16, "스튜디오 W": 5, "스튜디오 랜덤": 6, "스튜디오 패밀리": 9, "패밀리 쓰리룸": 5, "패밀리 투룸": 9 },
}


export default function Dashboard() {
  const [dailyData, setDailyData] = useState<any>(null)
  const [prevDailyData, setPrevDailyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [prevWeeklyData, setPrevWeeklyData] = useState<any>(null)
  const [toplineData, setToplineData] = useState<any>(null)
  const [roomTypeData, setRoomTypeData] = useState<any>(null)
  const [monthlySummaryData, setMonthlySummaryData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState('전지점') // 디폴트 전지점
  const [selectedRoomType, setSelectedRoomType] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(2)
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
  const roomTypeChartRef = useRef<HTMLCanvasElement>(null)
  const weeklyChartInstance = useRef<Chart | null>(null)
  const roomTypeChartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    fetchData()
    fetchRoomTypeData() // 초기 로드 시에도 실행
    fetchMonthlySummary() // 월별 요약 데이터
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

  const fetchData = async () => {
    setLoading(true)
    try {
      const branch = selectedBranch === '전지점' ? 'all' : selectedBranch
      const dateParam = selectedDate ? `&date=${selectedDate}` : ''
      
      // 전일 날짜 계산
      const currentDate = selectedDate ? new Date(selectedDate) : new Date()
      const prevDate = new Date(currentDate)
      prevDate.setDate(currentDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]
      
      // 주간 실적 날짜 계산
      const weekRange = getWeekRange(currentWeek)
      const weekStartStr = weekRange.start.toISOString().split('T')[0]
      const weekEndStr = weekRange.end.toISOString().split('T')[0]
      
      // 전주 날짜 계산
      const prevWeekRange = getWeekRange(currentWeek - 1)
      const prevWeekStartStr = prevWeekRange.start.toISOString().split('T')[0]
      const prevWeekEndStr = prevWeekRange.end.toISOString().split('T')[0]
      
      const [daily, prevDaily, monthly, weekly, prevWeekly, topline] = await Promise.all([
        fetch(`/api/daily?branch=${branch}${dateParam}`).then(r => r.json()),
        fetch(`/api/daily?branch=${branch}&date=${prevDateStr}`).then(r => r.json()),
        fetch(`/api/monthly?branch=${branch}&month=${selectedMonth}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${branch}&date=${weekEndStr}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${branch}&date=${prevWeekEndStr}`).then(r => r.json()),
        fetch(`/api/topline?branch=${branch}&month=${toplineMonth}`).then(r => r.json()),
      ])
      
      setDailyData(daily)
      setPrevDailyData(prevDaily)
      setMonthlyData(monthly)
      setWeeklyData(weekly)
      setPrevWeeklyData(prevWeekly)
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

    // 채널 그룹 색상
    const channelColors: Record<string, string> = {
      'OTA': 'rgba(59, 130, 246, 0.7)',      // 파랑
      '자사채널': 'rgba(16, 185, 129, 0.7)',  // 초록
      '에어비앤비': 'rgba(236, 72, 153, 0.7)', // 핑크
      'B2B': 'rgba(251, 146, 60, 0.7)',      // 오렌지
      '홈쇼핑': 'rgba(168, 85, 247, 0.7)',    // 보라
      'OD': 'rgba(34, 211, 238, 0.7)',       // 청록
      'LS': 'rgba(250, 204, 21, 0.7)',       // 노랑
      '무숙': 'rgba(156, 163, 175, 0.7)',     // 회색
      '기타': 'rgba(100, 116, 139, 0.7)'     // 어두운 회색
    }

    // 모든 날짜의 채널 그룹 수집
    const allChannels = new Set<string>()
    roomTypeData.days.forEach((d: any) => {
      if (d.channel_ratios) {
        Object.keys(d.channel_ratios).forEach(ch => allChannels.add(ch))
      }
    })

    // 채널별 데이터셋 생성 (stacked bar)
    const channelDatasets = Array.from(allChannels).map(channel => ({
      label: channel,
      data: roomTypeData.days.map((d: any) => {
        const ratio = d.channel_ratios?.[channel] || 0
        return d.occ * (ratio / 100) // OCC * 채널 비중
      }),
      backgroundColor: channelColors[channel] || 'rgba(100, 116, 139, 0.7)',
      yAxisID: 'y',
      stack: 'occ',
      order: 2
    }))

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          ...channelDatasets, // 채널별 stacked bar
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
          {
            label: 'LoS (평균 숙박일)',
            data: roomTypeData.days.map((d: any) => d.avg_los || 0),
            type: 'line',
            borderColor: 'rgba(139, 92, 246, 1)',
            borderWidth: 2,
            pointRadius: 3,
            yAxisID: 'y2',
            order: 0
          }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              filter: (item) => {
                // 채널은 범례에서 제외 (너무 많아서)
                return !allChannels.has(item.text)
              }
            }
          },
          datalabels: {
            display: false // 너무 복잡해지니까 비활성화
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || ''
                if (label) label += ': '
                
                if (context.dataset.yAxisID === 'y') {
                  // OCC (채널별 stacked)
                  return label + (context.parsed.y * 100).toFixed(1) + '%'
                } else if (context.dataset.yAxisID === 'y2') {
                  // LoS
                  return label + context.parsed.y.toFixed(1) + '박'
                } else {
                  // 가격
                  return label + new Intl.NumberFormat('ko-KR').format(context.parsed.y) + '원'
                }
              },
              afterLabel: function(context) {
                // OCC bar에 채널 비중 표시
                if (context.dataset.stack === 'occ') {
                  const dayData = roomTypeData.days[context.dataIndex]
                  const channel = context.dataset.label
                  const ratio = dayData.channel_ratios?.[channel] || 0
                  return `채널 비중: ${ratio.toFixed(1)}%`
                }
                return ''
              },
              footer: function(tooltipItems) {
                // 전체 OCC와 채널 비중 요약
                if (tooltipItems.length > 0) {
                  const dataIndex = tooltipItems[0].dataIndex
                  const dayData = roomTypeData.days[dataIndex]
                  
                  let footer = `\n총 OCC: ${(dayData.occ * 100).toFixed(1)}%`
                  
                  if (dayData.channel_ratios && Object.keys(dayData.channel_ratios).length > 0) {
                    footer += '\n\n채널별 비중:'
                    Object.entries(dayData.channel_ratios)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .forEach(([ch, ratio]: any) => {
                        footer += `\n${ch}: ${ratio.toFixed(1)}%`
                      })
                  }
                  
                  return footer
                }
                return ''
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            stacked: true, // stacked bar 활성화
            title: { display: true, text: 'OCC (%)' },
            ticks: {
              callback: (value) => (Number(value) * 100).toFixed(0) + '%'
            },
            max: 1
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '가격 (원)' },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (value) => new Intl.NumberFormat('ko-KR').format(Number(value))
            }
          },
          y2: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'LoS (박)' },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (value) => value + '박'
            }
          }
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
              <p className="text-sm text-gray-500 mt-1">실시간 현황</p>
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
