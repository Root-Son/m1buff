"""
M1버프 현황판 - 자동 데이터 동기화 스크립트
branch_room_occ: Google Sheets → upsert
yolo_prices: Google Sheets → upsert
price_guide: Google Sheets → upsert
raw_bookings: Redash → 당월 created_at 기준 삭제 후 재삽입
"""

import os
import requests
import pandas as pd
import time
from datetime import datetime, date

# 환경변수
REDASH_API_KEY = os.environ['REDASH_API_KEY']
REDASH_URL = os.environ['REDASH_URL']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
SHEET_ID = os.environ['SHEET_ID']

# 대시보드 지점 목록
DASHBOARD_BRANCHES = [
    '강남예전로이움점', '강남예전시그니티점', '거북섬점', '낙산해변',
    '당진터미널점', '호텔 동탄', '명동점', '부산기장점', '부산송도해변점',
    '부산시청점', '부산역점', '부티크남포BIFF점', '부티크익선점', '서면점',
    '속초등대해변점', '속초자이엘라더비치', '속초중앙점', '속초해변',
    '속초해변 AB점', '속초해변C점', '송도달빛공원점', '스타즈울산점',
    '웨이브파크점', '인천차이나타운', '제주공항점', '해운대역', '해운대패러그라프점'
]

# Redash 쿼리 ID
QUERIES = { 'raw_bookings': 711 }

# Google Sheets GID
SHEET_GIDS = {
    'branch_room_occ': '1130833605',
    'price_guide': '261469936',
    'yolo_prices': '1219169457'
}

# upsert용 unique constraint
UPSERT_KEYS = {
    'branch_room_occ': 'date,branch_name,room_type',
    'yolo_prices': 'date,branch_name,room_type',
    'price_guide': 'date,branch_name,room_type',
}


def execute_redash_query(query_id, parameters=None):
    """Redash 쿼리 실행 및 결과 가져오기"""
    print(f"🔄 쿼리 {query_id} 실행 중... (파라미터: {parameters})")

    headers = {'Authorization': f'Key {REDASH_API_KEY}'}

    refresh_url = f"{REDASH_URL}/api/queries/{query_id}/refresh"

    # 파라미터는 JSON body로 전달 (p_ prefix URL 방식은 refresh에서 작동 안함)
    body = None
    if parameters:
        body = {'parameters': parameters}

    response = requests.post(refresh_url, headers=headers, json=body)

    if response.status_code == 200:
        job = response.json()['job']
        result_url = f"{REDASH_URL}/api/jobs/{job['id']}"

        for attempt in range(120):
            result = requests.get(result_url, headers=headers).json()

            if result['job']['status'] == 3:
                print(f"✅ 쿼리 {query_id} 완료!")
                query_result_id = result['job']['query_result_id']
                data_url = f"{REDASH_URL}/api/query_results/{query_result_id}"
                data = requests.get(data_url, headers=headers).json()
                return pd.DataFrame(data['query_result']['data']['rows'])

            elif result['job']['status'] == 4:
                err = result['job'].get('error', 'unknown')
                raise Exception(f"쿼리 {query_id} 실행 실패! ({err})")

            time.sleep(3)

        raise Exception(f"쿼리 {query_id} 타임아웃!")
    else:
        print(f"  ⚠️ refresh 실패 ({response.status_code}): {response.text[:300]}")
        raise Exception(f"쿼리 {query_id} refresh 실패 (status={response.status_code})")


def get_redash_branchid_default(query_id, param_name='branchId'):
    """Redash 쿼리의 branchId 파라미터 기본값 가져오기"""
    headers = {'Authorization': f'Key {REDASH_API_KEY}'}

    query_url = f"{REDASH_URL}/api/queries/{query_id}"
    resp = requests.get(query_url, headers=headers)
    resp.raise_for_status()
    query_data = resp.json()

    for p in query_data.get('options', {}).get('parameters', []):
        if p.get('name') == param_name:
            default_val = p.get('value', '')
            print(f"  branchId 기본값: {default_val}")
            return default_val

    return None


def get_google_sheet_data(gid: str, sheet_name: str):
    """Google Sheets에서 데이터 가져오기"""
    print(f"🔄 Google Sheets ({sheet_name}) 데이터 가져오는 중...")
    csv_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    df = pd.read_csv(csv_url)
    print(f"✅ Google Sheets ({sheet_name}) 데이터 {len(df)}개 로드!")
    return df


def supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }


def delete_raw_bookings_by_created(month_start):
    """raw_bookings에서 당월 생성분 삭제 (reservation_created_at 기준)"""
    print(f"  🗑️ raw_bookings 당월 삭제 (reservation_created_at >= {month_start})...")
    headers = supabase_headers()

    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/raw_bookings?reservation_created_at=gte.{month_start}",
        headers=headers
    )
    print(f"  삭제 → status={resp.status_code}")

    if resp.status_code not in [200, 204]:
        print(f"  ⚠️ 삭제 응답: {resp.text[:200]}")


def upsert_to_supabase(table_name, data):
    """Supabase에 upsert (기존 데이터 업데이트, 신규 삽입)"""
    on_conflict = UPSERT_KEYS[table_name]
    print(f"🔄 {table_name} upsert 중... ({len(data)}개, on_conflict={on_conflict})")

    headers = {**supabase_headers(), 'Prefer': 'return=minimal,resolution=merge-duplicates'}

    batch_size = 1000
    total_batches = (len(data) + batch_size - 1) // batch_size

    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        batch_num = (i // batch_size) + 1

        url = f"{SUPABASE_URL}/rest/v1/{table_name}?on_conflict={on_conflict}"
        response = requests.post(url, headers=headers, json=batch)

        if response.status_code not in [200, 201]:
            print(f"  ❌ 배치 {batch_num}/{total_batches} 실패: {response.text[:200]}")
            response.raise_for_status()

        print(f"  - 배치 {batch_num}/{total_batches} 완료 ({len(batch)}개)")
        time.sleep(0.3)

    print(f"✅ {table_name} upsert 완료! (총 {len(data)}개)")


def insert_to_supabase(table_name, data):
    """Supabase에 단순 insert"""
    print(f"🔄 {table_name} insert 중... ({len(data)}개)")

    headers = supabase_headers()

    batch_size = 1000
    total_batches = (len(data) + batch_size - 1) // batch_size

    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        batch_num = (i // batch_size) + 1

        url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        response = requests.post(url, headers=headers, json=batch)

        if response.status_code not in [200, 201]:
            print(f"  ❌ 배치 {batch_num}/{total_batches} 실패: {response.text[:200]}")
            response.raise_for_status()

        print(f"  - 배치 {batch_num}/{total_batches} 완료 ({len(batch)}개)")
        time.sleep(0.3)

    print(f"✅ {table_name} insert 완료! (총 {len(data)}개)")


def normalize_branch_name(name):
    """지점명 통일"""
    if pd.isna(name):
        return None
    cleaned = str(name).strip()
    mapping = {
        '동탄점': '호텔 동탄',
        '호텔동탄': '호텔 동탄',
        '동탄호텔': '호텔 동탄',
        '동탄점(호텔)': '호텔 동탄',
    }
    return mapping.get(cleaned, cleaned)


def process_branch_room_occ(df):
    """branch_room_occ 데이터 처리"""
    column_map = {
        '일자': 'date', '지점': 'branch_name', '객실타입': 'room_type',
        'Available': 'available_rooms', 'Sold': 'sold_rooms', '방막': 'blocked_rooms',
        'ADR': 'adr', 'OCC': 'occ', 'Revenue': 'revenue', 'revPAR': 'rev_par',
        'OCC_현재': 'occ_asof', 'OCC_1일전': 'occ_1d_ago', 'OCC_7일전': 'occ_7d_ago',
        'delta_1일_pp': 'delta_1d_pp', 'delta_7일_pp': 'delta_7d_pp'
    }
    df = df.rename(columns=column_map)
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)

    numeric_cols = ['available_rooms', 'sold_rooms', 'blocked_rooms', 'adr', 'revenue', 'rev_par',
                    'occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago', 'delta_1d_pp', 'delta_7d_pp']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
            df[col] = pd.to_numeric(df[col], errors='coerce')

    for col in ['occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago']:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x / 100 if (pd.notna(x) and abs(x) > 1) else x)
            df[col] = df[col].clip(0, 1)

    for col in ['delta_1d_pp', 'delta_7d_pp']:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x / 100 if (pd.notna(x) and abs(x) > 1) else x)

    df = df.fillna(0)
    df = df.drop_duplicates(subset=['date', 'branch_name', 'room_type'], keep='last')
    return df.to_dict('records')


def process_yolo_prices(df):
    """yolo_prices 데이터 처리"""
    column_map = {'날짜': 'date', '지점': 'branch_name', '객실타입': 'room_type', '금액': 'price'}
    df = df.rename(columns=column_map)
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df['price'] = df['price'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    df = df[df['price'] > 0]
    df = df.drop_duplicates(subset=['date', 'branch_name', 'room_type'], keep='last')
    return df.to_dict('records')


def process_price_guide(df):
    """price_guide 데이터 처리"""
    if df.columns[0] != 'date':
        df.columns = ['date', 'branch_name', 'room_type', 'min_price']
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df = df[df['min_price'].notna() & (df['min_price'] != '-')]
    df['min_price'] = df['min_price'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
    df['min_price'] = pd.to_numeric(df['min_price'], errors='coerce')
    df = df.dropna(subset=['min_price'])
    df = df[df['min_price'] > 0]
    df = df.drop_duplicates(subset=['date', 'branch_name', 'room_type'], keep='last')
    return df.to_dict('records')


def process_raw_bookings(df):
    """raw_bookings 데이터 처리"""
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)

    # 대시보드 지점만 필터
    before = len(df)
    df = df[df['branch_name'].isin(DASHBOARD_BRANCHES)]
    print(f"  대시보드 지점 필터: {before}건 → {len(df)}건 ({len(df['branch_name'].unique())}개 지점)")

    if 'payment_amount' in df.columns:
        df['payment_amount'] = df['payment_amount'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
        df['payment_amount'] = pd.to_numeric(df['payment_amount'], errors='coerce')
    # reservation_no 기준 중복 제거
    if 'reservation_no' in df.columns:
        before_dedup = len(df)
        df = df.drop_duplicates(subset=['reservation_no'], keep='last')
        if before_dedup != len(df):
            print(f"  중복 제거: {before_dedup}건 → {len(df)}건")

    df = df.fillna(0)
    return df.to_dict('records')



def main():
    """메인 실행"""
    start_time = datetime.now()
    today = date.today()
    month_start = today.replace(day=1).strftime('%Y-%m-%d')
    today_str = today.strftime('%Y-%m-%d')

    print(f"\n{'='*60}")
    print(f"🚀 데이터 동기화 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   raw_bookings: 당월 created_at 삭제+재삽입 ({month_start} ~ {today_str})")
    print(f"   기타 테이블: upsert (전체)")
    print(f"{'='*60}\n")

    errors = []

    # 1. branch_room_occ (Google Sheets → upsert)
    try:
        print("\n[1/4] branch_room_occ (Google Sheets → upsert)")
        df = get_google_sheet_data(SHEET_GIDS['branch_room_occ'], 'branch_room_occ')
        data = process_branch_room_occ(df)
        upsert_to_supabase('branch_room_occ', data)
    except Exception as e:
        print(f"❌ branch_room_occ 실패: {e}")
        errors.append(('branch_room_occ', str(e)))

    # 2. yolo_prices (Google Sheets → upsert)
    try:
        print("\n[2/4] yolo_prices (Google Sheets → upsert)")
        df = get_google_sheet_data(SHEET_GIDS['yolo_prices'], 'yolo_prices')
        data = process_yolo_prices(df)
        upsert_to_supabase('yolo_prices', data)
    except Exception as e:
        print(f"❌ yolo_prices 실패: {e}")
        errors.append(('yolo_prices', str(e)))

    # 3. price_guide (Google Sheets → upsert)
    try:
        print("\n[3/4] price_guide (Google Sheets → upsert)")
        df = get_google_sheet_data(SHEET_GIDS['price_guide'], 'price_guide')
        data = process_price_guide(df)
        upsert_to_supabase('price_guide', data)
    except Exception as e:
        print(f"❌ price_guide 실패: {e}")
        errors.append(('price_guide', str(e)))

    # 4. raw_bookings (Redash → 당월만 삭제 후 insert)
    try:
        print("\n[4/4] raw_bookings (Redash → 당월 created_at 삭제+insert)")
        default_branch_id = get_redash_branchid_default(QUERIES['raw_bookings'])
        params = {
            'startDate': month_start,
            'endDate': today_str,
            'branchId': default_branch_id,
        }
        df = execute_redash_query(QUERIES['raw_bookings'], params)
        print(f"  Redash 조회: {len(df)}건")
        data = process_raw_bookings(df)
        delete_raw_bookings_by_created(month_start)
        insert_to_supabase('raw_bookings', data)
    except Exception as e:
        print(f"❌ raw_bookings 실패: {e}")
        errors.append(('raw_bookings', str(e)))

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print(f"\n{'='*60}")
    if errors:
        print(f"⚠️ 동기화 일부 실패 ({len(errors)}/4): {[e[0] for e in errors]}")
        print(f"소요시간: {duration:.1f}초 = {duration/60:.1f}분")
        print(f"{'='*60}\n")
        raise Exception(f"동기화 실패: {errors}")
    else:
        print(f"✅ 동기화 완료! (소요시간: {duration:.1f}초 = {duration/60:.1f}분)")
        print(f"{'='*60}\n")

if __name__ == '__main__':
    main()
