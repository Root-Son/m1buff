#!/usr/bin/env python3
"""
raw_booking_history에서 지점/룸타입/월/요일유형별 OCC 빌드업 커브를 계산하여
TypeScript 상수 파일로 출력합니다.

출력: lib/pace-benchmark-data.ts
"""

import json
import math
import sys
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime

SUPABASE_URL = "https://ttohmprndoenrxfywmkf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0b2htcHJuZG9lbnJ4Znl3bWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODMyMzcsImV4cCI6MjA4Nzc1OTIzN30.gHh62pUigjne-WiF-A5AiDswnD2cBIJS2b4oDJuNT6U"

# 리드타임 버킷 (일 단위)
LEAD_TIME_BUCKETS = [1, 2, 3, 5, 7, 10, 14, 21, 30]

# ROOM_COUNTS와 동일하게 유지
ROOM_COUNTS = {
    "강남예전로이움점": {"스튜디오": 30, "스튜디오 랜덤": 17, "스튜디오 베리어프리": 1, "패밀리 투룸": 24, "프리미어 스위트": 11},
    "강남예전시그니티점": {"스튜디오": 8, "패밀리 투룸": 5, "프리미어 스위트 (욕조)": 3, "프리미어 스위트 W": 42, "프리미어 스위트 랜덤": 18, "프리미어 스위트 패밀리": 7},
    "거북섬점": {"스튜디오": 39, "스튜디오 랜덤": 21, "스튜디오 시티": 36, "스튜디오 트윈": 43, "스튜디오_배리어프리": 2, "프리미어 스위트": 7},
    "낙산해변": {"스튜디오": 8, "스튜디오 설악": 21, "스튜디오 패밀리": 13, "스튜디오 패밀리 파셜 오션": 17, "프리미어 스위트 오션": 4},
    "당진터미널점": {"스튜디오": 105, "스튜디오 로프트": 35, "스튜디오 싱글": 4, "스튜디오 트윈": 33},
    "호텔 동탄": {"스탠다드": 23, "스탠다드 배리어프리": 3, "스탠다드 트윈": 22, "스탠다드(욕조)": 23},
    "명동점": {"스튜디오": 25, "스튜디오 시티": 24, "스튜디오 테라스": 2, "스튜디오 파노라마": 3},
    "부산기장점": {"패밀리 쓰리룸": 12, "패밀리 쓰리룸 오션": 7, "패밀리 투룸": 34, "패밀리 투룸 오션": 7},
    "부산송도해변점": {"스튜디오": 20, "스튜디오 스위트 W 오션": 4, "스튜디오 오션": 51, "스튜디오 트윈": 21, "스튜디오 트윈 오션": 3, "스튜디오 패밀리": 39, "스튜디오 패밀리 오션": 16, "스튜디오_배리어프리": 3, "패밀리 투룸 오션": 1},
    "부산시청점": {"스튜디오": 14, "스튜디오 W": 8, "스튜디오 랜덤": 23, "스튜디오 비즈니스": 4, "스튜디오 시티": 22},
    "부산역점": {"패밀리 쓰리룸 G": 7, "패밀리 쓰리룸 G 트리플": 1, "패밀리 쓰리룸 G 파노라마": 2, "패밀리 투룸 G": 4, "프리미어 스위트 G 커넥팅": 14, "프리미어 스위트 W": 11},
    "부티크남포BIFF점": {"가든 테라스": 1, "스튜디오": 21, "스튜디오 랜덤": 12, "스튜디오 시티": 26, "스튜디오 하버오션": 16},
    "부티크익선점": {"스튜디오": 16, "스튜디오 시티": 16, "스튜디오 트윈": 8, "스튜디오 파노라마": 6, "패밀리 투룸": 8},
    "서면점": {"스튜디오": 125, "스튜디오 랜덤": 32, "스튜디오 시티": 45, "스튜디오 싱글": 32, "스튜디오 트윈": 36},
    "속초등대해변점": {"스튜디오": 117, "스튜디오 W": 20, "스튜디오 랜덤": 68, "스튜디오 시티오션": 3, "스튜디오 패밀리": 13, "스튜디오 풀오션": 32},
    "속초자이엘라더비치": {"스튜디오": 35, "스튜디오 배리어프리": 3, "스튜디오 와이드 랜덤": 121, "스튜디오 와이드 오션": 39, "스튜디오 와이드(B)": 10, "스튜디오 트윈": 17, "스튜디오 프라이빗 스파": 4, "패밀리 투룸 오션": 4, "패밀리 투룸 파노라마 오션": 3, "프리미어 스위트": 4, "프리미어 스위트 오션": 9},
    "속초중앙점": {"스튜디오": 49, "스튜디오 랜덤": 36, "스튜디오 배리어프리": 6, "스튜디오 패밀리": 58, "패밀리 로프트 투룸": 1, "패밀리 쓰리룸": 8, "패밀리 와이드 로프트 투룸": 1, "패밀리 와이드 투룸": 10, "패밀리 와이드 투룸 A": 3, "패밀리 투룸": 34, "펜트하우스": 2},
    "속초해변": {"스튜디오": 11, "스튜디오 오션": 27, "스튜디오 트윈": 26, "스튜디오 파셜오션": 47, "패밀리 투룸": 3, "패밀리 투룸 오션": 8, "프리미어 스위트 오션": 3},
    "속초해변 AB점": {"스튜디오": 60, "스튜디오 가든": 45, "스튜디오 랜덤": 59, "스튜디오 트윈": 3, "스튜디오 패밀리": 33, "프리미어 스위트": 1},
    "속초해변C점": {"스튜디오": 25, "스튜디오 파셜 오션": 15, "패밀리 투룸 오션": 7, "프리미어 스위트 오션": 21, "프리미어 스위트 코너": 6},
    "송도달빛공원점": {"스튜디오": 40, "스튜디오 W": 7, "스튜디오 랜덤": 12, "스튜디오 비즈니스": 34, "스튜디오 시티": 41, "패밀리 투룸": 1, "프리미어 스위트": 9},
    "스타즈울산점": {"디럭스 패밀리 트윈": 24, "스위트": 5, "스탠다드 더블": 150, "스탠다드 싱글": 34, "스탠다드 트윈": 96, "스탠다드더블_배리어프리": 2, "이그제큐티브 더블": 10, "주니어 스위트": 6},
    "웨이브파크점": {"스튜디오": 37, "스튜디오 로프트": 41, "스튜디오 로프트 서프": 32, "스튜디오 로프트 트윈": 32, "스튜디오 로프트 파셜 오션": 22, "스튜디오 로프트 패밀리": 40, "패밀리 투룸 오션": 13, "프리미어 스위트 패밀리": 53},
    "인천차이나타운": {"스튜디오 (B)": 35, "스튜디오 W": 1, "스튜디오 랜덤": 4, "스튜디오 트윈": 44, "스튜디오 하버오션": 20, "스튜디오_배리어프리": 1, "패밀리 쓰리룸": 6, "패밀리 투룸": 14},
    "제주공항점": {"스튜디오": 42, "스튜디오 W": 9, "스튜디오 싱글": 9, "프리미어 스위트": 7},
    "해운대역": {"스튜디오": 16, "스튜디오 랜덤": 15, "스튜디오 트윈": 14, "프리미어 스위트": 23, "프리미어 스위트 오션": 6, "프리미어 스위트 트윈": 16, "프리미어 스위트 패밀리": 13, "프리미어 스위트 패밀리 오션": 12},
    "해운대패러그라프점": {"스튜디오": 16, "스튜디오 W": 5, "스튜디오 랜덤": 6, "스튜디오 패밀리": 9, "패밀리 쓰리룸": 5, "패밀리 투룸": 9},
}


def fetch_page(branch_name, page, check_in_from="2025-01-01", check_in_to="2026-03-09"):
    """Supabase에서 한 페이지 (1000건) 가져오기"""
    import time
    page_size = 1000
    offset = page * page_size

    encoded_branch = urllib.parse.quote(branch_name, safe='')
    url = (
        f"{SUPABASE_URL}/rest/v1/raw_booking_history"
        f"?select=roomtype,check_in_date,lead_time"
        f"&branch_name=eq.{encoded_branch}"
        f"&check_in_date=gte.{check_in_from}"
        f"&check_in_date=lte.{check_in_to}"
        f"&order=check_in_date.asc"
        f"&limit={page_size}"
        f"&offset={offset}"
    )

    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt < 2:
                print(f"  Retry {attempt+1} for {branch_name} page {page}: {e}", file=sys.stderr)
                time.sleep(2)
            else:
                print(f"  FAILED {branch_name} page {page}: {e}", file=sys.stderr)
                return []


def fetch_all_for_branch(branch_name):
    """한 지점의 모든 예약 데이터 가져오기"""
    all_rows = []
    page = 0
    while True:
        rows = fetch_page(branch_name, page)
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < 1000:
            break
        page += 1
        if page % 10 == 0:
            print(f"  ... {branch_name}: {len(all_rows)} rows fetched", file=sys.stderr)
    return all_rows


def get_dow_type(date_str):
    """요일 유형: weekend (금토일) vs weekday"""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return "weekend" if d.weekday() in [4, 5, 6] else "weekday"  # 0=Mon, 4=Fri, 5=Sat, 6=Sun


def compute_benchmarks():
    """전 지점 벤치마크 계산 — 판매 객실수 기반 (OCC X, 실수 기반)"""
    benchmarks = {}

    for branch_name, room_types in ROOM_COUNTS.items():
        print(f"Processing: {branch_name}", file=sys.stderr)
        rows = fetch_all_for_branch(branch_name)
        print(f"  Fetched {len(rows)} rows", file=sys.stderr)

        if not rows:
            continue

        # 그룹핑: (roomtype, check_in_date) → [lead_times]
        date_bookings = defaultdict(lambda: defaultdict(list))
        for row in rows:
            rt = row["roomtype"]
            cid = row["check_in_date"]
            lt = row["lead_time"] or 0
            date_bookings[rt][cid].append(lt)

        # 각 roomtype에 대해 벤치마크 계산
        for rt in room_types:
            rt_dates = date_bookings.get(rt, {})
            if not rt_dates:
                continue

            # 월/요일유형별 그룹핑
            month_dow_curves = defaultdict(lambda: defaultdict(list))

            for cid, lead_times in rt_dates.items():
                month = int(cid[5:7])
                dow_type = get_dow_type(cid)

                # 각 리드타임 버킷에서의 누적 판매 객실수 (실수 그대로)
                for bucket in LEAD_TIME_BUCKETS:
                    sold_by = sum(1 for lt in lead_times if lt >= bucket)
                    month_dow_curves[(month, dow_type)][bucket].append(sold_by)

            # 중앙값 계산
            for (month, dow_type), bucket_values in month_dow_curves.items():
                curve = {}
                for bucket in LEAD_TIME_BUCKETS:
                    values = bucket_values.get(bucket, [])
                    if len(values) >= 3:  # 최소 3개 데이터 필요
                        values.sort()
                        median = values[len(values) // 2]
                        curve[bucket] = median  # 정수 (판매 객실수)

                if curve:
                    key = f"{branch_name}|{rt}|{month}|{dow_type}"
                    benchmarks[key] = curve

    return benchmarks


def write_json(benchmarks, output_path):
    """JSON 파일 생성 (판매 객실수 기반)"""
    # key → { "lead_time": sold_rooms } (정수값)
    output = {}
    for key in sorted(benchmarks.keys()):
        curve = benchmarks[key]
        output[key] = {str(k): v for k, v in sorted(curve.items())}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"Written to {output_path} ({len(output)} entries)", file=sys.stderr)


if __name__ == "__main__":
    print("=== Building Pace Benchmarks ===", file=sys.stderr)
    benchmarks = compute_benchmarks()
    print(f"\nTotal benchmark entries: {len(benchmarks)}", file=sys.stderr)

    output_path = "lib/pace-benchmark-data.ts"
    write_typescript(benchmarks, output_path)
    print("Done!", file=sys.stderr)
