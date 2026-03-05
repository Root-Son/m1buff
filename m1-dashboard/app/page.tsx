'use client'

import { useEffect, useState, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const BRANCH_ROOMTYPES: Record<string, string[]> = {
  '강남예전로이움점': ['스튜디오', '스튜디오 랜덤', '스튜디오 배리어프', '패밀리 투룸', '프리미어 스위트'],
  // ... 나머지 지점들
}

export default function Dashboard() {
  const [selectedBranch, setSelectedBranch] = useState('전지점')
  const [selectedRoomType, setSelectedRoomType] = useState('')
  const [loading, setLoading] = useState(true)
  const [toplineData, setToplineData] = useState<any>(null)
  const [dailyData, setDailyData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [roomTypeData, setRoomTypeData] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  
  const roomTypeChartRef = useRef<HTMLCanvasElement>(null)
  const roomTypeChartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    fetchAllData()
  }, [selectedBranch, selectedMonth])

  useEffect(() => {
    if (selectedBranch !== '전지점' && roomTypeData) {
      renderRoomTypeChart()
    }
  }, [roomTypeData, selectedRoomType])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [topline, daily, weekly, monthly] = await Promise.all([
        fetch(`/api/topline?branch=${selectedBranch}&month=${selectedMonth}`).then(r => r.json()),
        fetch(`/api/daily?branch=${selectedBranch}`).then(r => r.json()),
        fetch(`/api/weekly?branch=${selectedBranch}`).then(r => r.json()),
        fetch(`/api/monthly?branch=${selectedBranch}`).then(r => r.json())
      ])
      
      setToplineData(topline)
      setDailyData(daily)
      setWeeklyData(weekly)
      setMonthlyData(monthly)

      if (selectedBranch !== '전지점') {
        const roomtype = await fetch(`/api/roomtype?branch=${selectedBranch}`).then(r => r.json())
        setRoomTypeData(roomtype)
        
        const types = BRANCH_ROOMTYPES[selectedBranch] || []
        if (types.length > 0 && !selectedRoomType) {
          setSelectedRoomType(types[0])
        }
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    }
    setLoading(false)
  }

  const renderRoomTypeChart = () => {
    if (!roomTypeChartRef.current || !roomTypeData) return
    
    if (roomTypeChartInstance.current) {
      roomTypeChartInstance.current.destroy()
    }

    const filtered = selectedRoomType 
      ? roomTypeData.filter((d: any) => d.room_type === selectedRoomType)
      : roomTypeData

    const ctx = roomTypeChartRef.current.getContext('2d')
    if (!ctx) return

    const config = {
      type: 'bar',
      data: {
        labels: filtered.map((d: any) => d.date),
        datasets: [
          {
            label: 'D-7 OCC',
            data: filtered.map((d: any) => d.occ_7d_ago),
            backgroundColor: 'rgba(156, 163, 175, 0.8)',
            yAxisID: 'y'
          },
          {
            label: 'OCC',
            data: filtered.map((d: any) => d.occ),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            yAxisID: 'y'
          },
          {
            label: '셋팅가',
            data: filtered.map((d: any) => d.yolo_price),
            type: 'line',
            borderColor: 'rgba(249, 115, 22, 1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1'
          },
          {
            label: '가드레일',
            data: filtered.map((d: any) => d.guardrail_price),
            type: 'line',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            yAxisID: 'y1'
          },
          {
            label: 'ADR',
            data: filtered.map((d: any) => d.adr),
            type: 'line',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 2,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: function(context: any) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">로딩중...</div>
      </div>
    )
  }

  const roomTypes = selectedBranch === '전지점' ? [] : (BRANCH_ROOMTYPES[selectedBranch] || [])

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
            <button
              onClick={() => setSelectedBranch('전지점')}
              className={`px-4 py-2 rounded ${
                selectedBranch === '전지점'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              전지점
            </button>
            {Object.keys(BRANCH_ROOMTYPES).sort((a, b) => a.localeCompare(b, 'ko')).map(branch => (
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
        {/* Topline */}
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

        {/* 룸타입별 성과 */}
        {selectedBranch !== '전지점' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <h2 className="text-xl font-bold mb-4">룸타입별 성과</h2>
          {roomTypes.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {roomTypes.map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedRoomType(rt)}
                  className={`px-4 py-2 rounded ${
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
          <div className="h-96">
            <canvas ref={roomTypeChartRef}></canvas>
          </div>
        </div>
        )}

      </main>
    </div>
  )
}
