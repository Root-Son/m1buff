"""
M1버프 현황판 - 자동 데이터 동기화 스크립트
branch_room_occ: Google Sheets
yolo_prices: Redash
price_guide: Google Sheets  
raw_bookings: Redash
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

# Redash 쿼리 ID (yolo_prices, raw_bookings만 사용)
QUERIES = {
    'yolo_prices': 728,
    'raw_bookings': 711
}

# 날짜 범위 설정
DATE_RANGES = {
    'yolo_prices': {
        'start': '2026-01-01',
        'end': date.today().strftime('%Y-%m-%d')
    },
    'raw_bookings': {
        'start': '2025-01-01',
        'end': date.today().strftime('%Y-%m-%d')
    }
}

# Google Sheets GID
SHEET_GIDS = {
    'branch_room_occ': '1130833605',
    'price_guide': '261469936',
    'yolo_prices': '1219169457'
}

def execute_redash_query(query_id, parameters=None):
    """Redash 쿼리 실행 및 결과 가져오기"""
    print(f"🔄 쿼리 {query_id} 실행 중... (파라미터: {parameters})")

    headers = {'Authorization': f'Key {REDASH_API_KEY}'}

    # 쿼리 정보 조회 (파라미터 확인)
    query_info_url = f"{REDASH_URL}/api/queries/{query_id}"
    qi = requests.get(query_info_url, headers=headers)
    if qi.status_code == 200:
        q = qi.json()
        opts = q.get('options', {}).get('parameters', [])
        print(f"  쿼리 파라미터 정의: {[(p.get('name'), p.get('type')) for p in opts]}")

    # 1차: refresh (실행 요청)
    refresh_url = f"{REDASH_URL}/api/queries/{query_id}/refresh"
    query_params = {}
    if parameters:
        for k, v in parameters.items():
            query_params[f'p_{k}'] = v

    response = requests.post(refresh_url, headers=headers, params=query_params)
    print(f"  Refresh response: {response.status_code} - {response.text[:300]}")

    if response.status_code == 200:
        job = response.json()['job']
        print(f"  Job status: {job.get('status')}, id: {job.get('id')}")
        result_url = f"{REDASH_URL}/api/jobs/{job['id']}"
        max_attempts = 120

        for attempt in range(max_attempts):
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
        # refresh 실패 시 → 최신 캐시된 결과 가져오기
        print(f"  ⚠️ refresh 실패 ({response.status_code}), 최신 캐시 결과 시도...")
        query_url = f"{REDASH_URL}/api/queries/{query_id}"
        query_info = requests.get(query_url, headers=headers)
        query_info.raise_for_status()
        query_data = query_info.json()

        result_id = query_data.get('latest_query_data_id')
        if not result_id:
            raise Exception(f"쿼리 {query_id}: refresh 실패 + 캐시 결과 없음 (status={response.status_code}, body={response.text[:200]})")

        data_url = f"{REDASH_URL}/api/query_results/{result_id}"
        data = requests.get(data_url, headers=headers).json()
        print(f"✅ 쿼리 {query_id} 캐시 결과 사용!")
        return pd.DataFrame(data['query_result']['data']['rows'])

def get_google_sheet_data(gid: str, sheet_name: str):
    """Google Sheets에서 데이터 가져오기"""
    print(f"🔄 Google Sheets ({sheet_name}) 데이터 가져오는 중...")
    
    csv_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    
    df = pd.read_csv(csv_url)
    print(f"✅ Google Sheets ({sheet_name}) 데이터 {len(df)}개 로드!")
    
    return df

# 테이블별 unique constraint 컬럼 (upsert용)
UPSERT_KEYS = {
    'branch_room_occ': 'date,branch_name,room_type',
    'yolo_prices': 'date,branch_name,room_type',
    'price_guide': 'date,branch_name,room_type',
    # raw_bookings는 unique constraint 없을 수 있으므로 delete+insert
}

def upload_to_supabase(table_name, data):
    """Supabase에 데이터 업로드 (upsert 또는 delete+insert)"""
    print(f"🔄 {table_name} 테이블 업로드 중... ({len(data)}개)")

    base_headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    }

    on_conflict = UPSERT_KEYS.get(table_name, '')

    # unique constraint가 없는 테이블은 delete+insert
    if not on_conflict:
        print(f"  - 기존 데이터 삭제 중...")
        delete_response = requests.delete(
            f"{SUPABASE_URL}/rest/v1/{table_name}?id=gt.0",
            headers={**base_headers, 'Prefer': 'return=minimal'}
        )
        if delete_response.status_code not in [200, 204]:
            # id 컬럼이 없을 수 있으니 date로도 시도
            delete_response = requests.delete(
                f"{SUPABASE_URL}/rest/v1/{table_name}?date=gte.1900-01-01",
                headers={**base_headers, 'Prefer': 'return=minimal'}
            )
        print(f"  ✅ 기존 데이터 삭제 완료 (status={delete_response.status_code})")

    headers = {**base_headers, 'Prefer': 'return=minimal,resolution=merge-duplicates'} if on_conflict else {**base_headers, 'Prefer': 'return=minimal'}

    # 배치 업로드 (1000개씩)
    batch_size = 1000
    total_batches = (len(data) + batch_size - 1) // batch_size

    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        batch_num = (i // batch_size) + 1

        url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        if on_conflict:
            url += f"?on_conflict={on_conflict}"
        response = requests.post(url, headers=headers, json=batch)

        if response.status_code not in [200, 201]:
            print(f"  ❌ 배치 {batch_num}/{total_batches} 실패: {response.text}")
            response.raise_for_status()

        print(f"  - 배치 {batch_num}/{total_batches} 완료 ({len(batch)}개)")
        time.sleep(0.3)

    print(f"✅ {table_name} 업로드 완료! (총 {len(data)}개)")

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
    """branch_room_occ 데이터 처리 (Google Sheets)"""
    # 컬럼명 매핑
    column_map = {
        '일자': 'date',
        '지점': 'branch_name',
        '객실타입': 'room_type',
        'Available': 'available_rooms',
        'Sold': 'sold_rooms',
        '방막': 'blocked_rooms',
        'ADR': 'adr',
        'OCC': 'occ',
        'Revenue': 'revenue',
        'revPAR': 'rev_par',  # ← 언더스코어
        'OCC_현재': 'occ_asof',
        'OCC_1일전': 'occ_1d_ago',
        'OCC_7일전': 'occ_7d_ago',
        'delta_1일_pp': 'delta_1d_pp',  # ← _pp 추가
        'delta_7일_pp': 'delta_7d_pp'   # ← _pp 추가
    }
    
    df = df.rename(columns=column_map)

    # 지점명 통일
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)

    # 숫자 컬럼 쉼표 제거 및 숫자 변환
    numeric_cols = ['available_rooms', 'sold_rooms', 'blocked_rooms', 'adr', 'revenue', 'rev_par',
                    'occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago', 'delta_1d_pp', 'delta_7d_pp']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # OCC 값들을 소수로 변환 (퍼센트 → 0~1 범위, DB가 numeric(5,4))
    for col in ['occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago']:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x / 100 if (pd.notna(x) and abs(x) > 1) else x)

    # OCC 값을 0~1 범위로 클램핑 (DB overflow 방지)
    for col in ['occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago']:
        if col in df.columns:
            df[col] = df[col].clip(0, 1)

    # delta_pp도 퍼센트→소수 변환 (DB가 numeric(5,4), max 9.9999)
    for col in ['delta_1d_pp', 'delta_7d_pp']:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: x / 100 if (pd.notna(x) and abs(x) > 1) else x)

    # NULL 처리
    df = df.fillna(0)

    # 중복 제거 (date, branch_name, room_type 기준)
    before = len(df)
    df = df.drop_duplicates(subset=['date', 'branch_name', 'room_type'], keep='last')
    if len(df) < before:
        print(f"  ℹ️ 중복 {before - len(df)}개 제거 → {len(df)}개")

    # 디버깅: 이상값 확인
    for col in ['occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago']:
        if col in df.columns:
            bad = df[df[col] > 1]
            if len(bad) > 0:
                print(f"  ⚠️ {col}: {len(bad)}개 행이 1 초과 (max={df[col].max()})")
    for col in ['delta_1d_pp', 'delta_7d_pp']:
        if col in df.columns:
            bad = df[df[col].abs() > 9.9]
            if len(bad) > 0:
                print(f"  ⚠️ {col}: {len(bad)}개 행이 abs>9.9 (max={df[col].max()}, min={df[col].min()})")
    for col in ['revenue', 'adr', 'rev_par']:
        if col in df.columns:
            print(f"  ℹ️ {col}: max={df[col].max()}, min={df[col].min()}")

    return df.to_dict('records')

def process_yolo_prices(df):
    """yolo_prices 데이터 처리 (Redash)"""
    column_map = {
        '날짜': 'date',
        '지점': 'branch_name',
        '객실타입': 'room_type',
        '금액': 'price'
    }
    
    df = df.rename(columns=column_map)
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df['price'] = df['price'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
    df['price'] = pd.to_numeric(df['price'], errors='coerce')
    df = df[df['price'] > 0]

    return df.to_dict('records')

def process_price_guide(df):
    """price_guide 데이터 처리 (Google Sheets)"""
    if df.columns[0] != 'date':
        df.columns = ['date', 'branch_name', 'room_type', 'min_price']
    
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df = df[df['min_price'].notna() & (df['min_price'] != '-')]
    
    df['min_price'] = df['min_price'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
    df['min_price'] = pd.to_numeric(df['min_price'], errors='coerce')
    df = df.dropna(subset=['min_price'])
    df = df[df['min_price'] > 0]
    
    return df.to_dict('records')

def process_raw_bookings(df):
    """raw_bookings 데이터 처리 (Redash)"""
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    if 'payment_amount' in df.columns:
        df['payment_amount'] = df['payment_amount'].apply(lambda x: str(x).replace(',', '') if pd.notna(x) else x)
        df['payment_amount'] = pd.to_numeric(df['payment_amount'], errors='coerce')
    df = df.fillna(0)

    return df.to_dict('records')

def main():
    """메인 실행"""
    start_time = datetime.now()
    print(f"\n{'='*60}")
    print(f"🚀 데이터 동기화 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    errors = []

    # 1. branch_room_occ (Google Sheets)
    try:
        print("\n[1/4] branch_room_occ 동기화 (Google Sheets)")
        df_occ = get_google_sheet_data(SHEET_GIDS['branch_room_occ'], 'branch_room_occ')
        data_occ = process_branch_room_occ(df_occ)
        upload_to_supabase('branch_room_occ', data_occ)
    except Exception as e:
        print(f"❌ branch_room_occ 실패: {e}")
        errors.append(('branch_room_occ', str(e)))

    # 2. yolo_prices (Google Sheets — Redash 쿼리 파라미터 호환성 문제로 전환)
    try:
        print("\n[2/4] yolo_prices 동기화 (Google Sheets)")
        df_yolo = get_google_sheet_data(SHEET_GIDS['yolo_prices'], 'yolo_prices')
        data_yolo = process_yolo_prices(df_yolo)
        upload_to_supabase('yolo_prices', data_yolo)
    except Exception as e:
        print(f"❌ yolo_prices 실패: {e}")
        errors.append(('yolo_prices', str(e)))

    # 3. price_guide (Google Sheets)
    try:
        print("\n[3/4] price_guide 동기화 (Google Sheets)")
        df_guide = get_google_sheet_data(SHEET_GIDS['price_guide'], 'price_guide')
        data_guide = process_price_guide(df_guide)
        upload_to_supabase('price_guide', data_guide)
    except Exception as e:
        print(f"❌ price_guide 실패: {e}")
        errors.append(('price_guide', str(e)))

    # 4. raw_bookings (Redash - 대용량)
    try:
        print("\n[4/4] raw_bookings 동기화 (Redash - 대용량)")
        params_bookings = {
            'startDate': DATE_RANGES['raw_bookings']['start'],
            'endDate': DATE_RANGES['raw_bookings']['end'],
            'branch': '%'
        }
        df_bookings = execute_redash_query(QUERIES['raw_bookings'], params_bookings)
        data_bookings = process_raw_bookings(df_bookings)
        upload_to_supabase('raw_bookings', data_bookings)
    except Exception as e:
        print(f"❌ raw_bookings 실패: {e}")
        errors.append(('raw_bookings', str(e)))

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print(f"\n{'='*60}")
    if errors:
        print(f"⚠️ 동기화 일부 실패 ({len(errors)}/{4}): {[e[0] for e in errors]}")
        print(f"소요시간: {duration:.1f}초 = {duration/60:.1f}분")
        print(f"{'='*60}\n")
        raise Exception(f"동기화 실패: {errors}")
    else:
        print(f"✅ 동기화 완료! (소요시간: {duration:.1f}초 = {duration/60:.1f}분)")
        print(f"{'='*60}\n")

if __name__ == '__main__':
    main()
