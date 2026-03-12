import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BRANCHES = [
  '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
  '당진터미널점', '호텔 동탄', '명동점', '부산기장점', '부산송도해변점',
  '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
  '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
  '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
  '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
]

async function fetchMonthStats(branch: string, month: number) {
  const { data, error } = await supabase
    .rpc('get_monthly_stats_dynamic', { p_branch: branch, p_month: month })
  if (error) throw error
  return data?.[0]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const branch = searchParams.get('branch') || 'all'
  const monthParam = searchParams.get('month')

  try {
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth() + 1

    if (branch !== 'all') {
      const result = await fetchMonthStats(branch, month)
      return NextResponse.json({
        branch,
        month,
        pickup: result?.pickup || 0,
        pickup_mom: result?.pickup_mom || 0,
        month1: result?.month1 || 0,
        month1_ci: result?.month1_ci || 0,
        month1_ci_mom: result?.month1_ci_mom || 0,
        month2: result?.month2 || 0,
        month2_ci: result?.month2_ci || 0,
        month2_ci_mom: result?.month2_ci_mom || 0,
        month3: result?.month3 || 0,
        month3_ci: result?.month3_ci || 0,
        month3_ci_mom: result?.month3_ci_mom || 0,
      })
    }

    // 전지점: 개별 지점 합산
    const results = await Promise.all(
      BRANCHES.map(b => fetchMonthStats(b, month))
    )

    let pickup = 0, month1_ci = 0, month2_ci = 0, month3_ci = 0
    let month1 = 0, month2 = 0, month3 = 0

    for (const r of results) {
      if (!r) continue
      pickup += r.pickup || 0
      month1_ci += r.month1_ci || 0
      month2_ci += r.month2_ci || 0
      month3_ci += r.month3_ci || 0
      if (!month1 && r.month1) month1 = r.month1
      if (!month2 && r.month2) month2 = r.month2
      if (!month3 && r.month3) month3 = r.month3
    }

    // MoM: 전월 합산해서 계산
    const prevMonth = month === 1 ? 12 : month - 1
    const prevResults = await Promise.all(
      BRANCHES.map(b => fetchMonthStats(b, prevMonth))
    )

    let prevPickup = 0, prevMonth1Ci = 0, prevMonth2Ci = 0, prevMonth3Ci = 0
    for (const r of prevResults) {
      if (!r) continue
      prevPickup += r.pickup || 0
      prevMonth1Ci += r.month1_ci || 0
      prevMonth2Ci += r.month2_ci || 0
      prevMonth3Ci += r.month3_ci || 0
    }

    const calcMom = (curr: number, prev: number) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : 0

    return NextResponse.json({
      branch: 'all',
      month,
      pickup,
      pickup_mom: calcMom(pickup, prevPickup),
      month1,
      month1_ci,
      month1_ci_mom: calcMom(month1_ci, prevMonth1Ci),
      month2,
      month2_ci,
      month2_ci_mom: calcMom(month2_ci, prevMonth2Ci),
      month3,
      month3_ci,
      month3_ci_mom: calcMom(month3_ci, prevMonth3Ci),
    })
  } catch (error: any) {
    console.error('Monthly API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
