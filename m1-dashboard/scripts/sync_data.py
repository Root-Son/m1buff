"""
M1버프 현황판 - 자동 데이터 동기화 스크립트 (파라미터 버전)
Redash 쿼리 결과 + Google Sheets → Supabase
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

# Redash 쿼리 ID
QUERIES = {
    'branch_room_occ': 737,
    'yolo_prices': 728,
    'raw_bookings': 711
}

# 날짜 범위 설정
DATE_RANGES = {
    'branch_room_occ': {
        'start': '2026-01-01',
        'end': date.today().strftime('%Y-%m-%d')
    },
    'yolo_prices': {
        'start': '2026-01-01',
        'end': date.today().strftime('%Y-%m-%d')
    },
    'raw_bookings': {
        'start': '2025-01-01',
        'end': date.today().strftime('%Y-%m-%d')
    }
}

def execute_redash_query(query_id, parameters=None):
    """Redash 쿼리 실행 및 결과 가져오기 (파라미터 포함)"""
    print(f"🔄 쿼리 {query_id} 실행 중... (파라미터: {parameters})")
    
    # 쿼리 실행
    refresh_url = f"{REDASH_URL}/api/queries/{query_id}/refresh"
    headers = {'Authorization': f'Key {REDASH_API_KEY}'}
    
    payload = {}
    if parameters:
        payload['parameters'] = parameters
    
    response = requests.post(refresh_url, headers=headers, json=payload)
    response.raise_for_status()
    
    job = response.json()['job']
    
    # 결과 대기
    result_url = f"{REDASH_URL}/api/jobs/{job['id']}"
    max_attempts = 120  # raw_bookings는 시간 오래 걸릴 수 있음
    
    for attempt in range(max_attempts):
        result = requests.get(result_url, headers=headers).json()
        
        if result['job']['status'] == 3:  # 완료
            print(f"✅ 쿼리 {query_id} 완료!")
            
            # 결과 가져오기
            query_result_id = result['job']['query_result_id']
            data_url = f"{REDASH_URL}/api/query_results/{query_result_id}"
            data = requests.get(data_url, headers=headers).json()
            
            return pd.DataFrame(data['query_result']['data']['rows'])
        
        elif result['job']['status'] == 4:  # 실패
            raise Exception(f"쿼리 {query_id} 실행 실패!")
        
        time.sleep(3)
    
    raise Exception(f"쿼리 {query_id} 타임아웃!")

def get_google_sheet_data():
    """Google Sheets에서 price_guide 데이터 가져오기"""
    print("🔄 Google Sheets 데이터 가져오는 중...")
    
    # CSV export URL
    gid = '261469936'  # price_guide 시트 GID
    csv_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    
    df = pd.read_csv(csv_url)
    print(f"✅ Google Sheets 데이터 {len(df)}개 로드!")
    
    return df

def upload_to_supabase(table_name, data):
    """Supabase에 데이터 업로드 (전체 교체)"""
    print(f"🔄 {table_name} 테이블 전체 교체 중... ({len(data)}개)")
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    
    # 1. 기존 데이터 전체 삭제
    print(f"  - 기존 데이터 삭제 중...")
    delete_url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    
    # 전체 삭제 (조건 없이)
    delete_response = requests.delete(
        f"{delete_url}?id=gte.0",  # 모든 레코드
        headers=headers
    )
    
    if delete_response.status_code not in [200, 204]:
        print(f"  ⚠️ 삭제 실패: {delete_response.text}")
    else:
        print(f"  ✅ 기존 데이터 삭제 완료")
    
    # 2. 새 데이터 배치 업로드 (1000개씩)
    batch_size = 1000
    total_batches = (len(data) + batch_size - 1) // batch_size
    
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        
        insert_url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        response = requests.post(insert_url, headers=headers, json=batch)
        
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
    
    # 특수 케이스만 매핑
    mapping = {
        '동탄점': '동탄점(호텔)',
        '호텔동탄': '동탄점(호텔)',
        '동탄호텔': '동탄점(호텔)',
        '호텔 동탄': '동탄점(호텔)',
    }
    
    return mapping.get(cleaned, cleaned)

def process_branch_room_occ(df):
    """branch_room_occ 데이터 처리"""
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
        'revPAR': 'revpar',
        'OCC_현재': 'occ_asof',
        'OCC_1일전': 'occ_1d_ago',
        'OCC_7일전': 'occ_7d_ago',
        'delta_1일_pp': 'delta_1d',
        'delta_7일_pp': 'delta_7d'
    }
    
    df = df.rename(columns=column_map)
    
    # 지점명 통일
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    
    # OCC 값들을 소수로 변환 (100으로 나누기)
    for col in ['occ', 'occ_asof', 'occ_1d_ago', 'occ_7d_ago']:
        if col in df.columns:
            df[col] = df[col] / 100
    
    # NULL 처리
    df = df.fillna(0)
    
    return df.to_dict('records')

def process_yolo_prices(df):
    """yolo_prices 데이터 처리"""
    # 컬럼명 매핑
    column_map = {
        '날짜': 'date',
        '지점': 'branch_name',
        '객실타입': 'room_type',
        '금액': 'price'
    }
    
    df = df.rename(columns=column_map)
    
    # 지점명 통일
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    
    # 불필요한 데이터 제거
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df = df[df['price'] > 0]
    
    return df.to_dict('records')

def process_price_guide(df):
    """price_guide 데이터 처리 (Google Sheets)"""
    # 첫 행이 헤더인지 확인
    if df.columns[0] != 'date':
        df.columns = ['date', 'branch_name', 'room_type', 'min_price']
    
    # 지점명 통일
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    
    # 불필요한 데이터 제거
    df = df[df['room_type'].notna() & (df['room_type'] != '-')]
    df = df[df['min_price'].notna() & (df['min_price'] != '-')]
    
    # 가격을 숫자로 변환
    df['min_price'] = pd.to_numeric(df['min_price'], errors='coerce')
    df = df.dropna(subset=['min_price'])
    df = df[df['min_price'] > 0]
    
    return df.to_dict('records')

def process_raw_bookings(df):
    """raw_bookings 데이터 처리"""
    # 지점명 통일
    df['branch_name'] = df['branch_name'].apply(normalize_branch_name)
    
    # NULL 처리
    df = df.fillna(0)
    
    return df.to_dict('records')

def main():
    """메인 실행"""
    start_time = datetime.now()
    print(f"\n{'='*60}")
    print(f"🚀 데이터 동기화 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    try:
        # 1. branch_room_occ (2026-01-01 ~ 오늘)
        print("\n[1/4] branch_room_occ 동기화")
        params_occ = {
            'startDate': DATE_RANGES['branch_room_occ']['start'],
            'endDate': DATE_RANGES['branch_room_occ']['end']
            # branchId는 쿼리에 디폴트 값 사용
        }
        df_occ = execute_redash_query(QUERIES['branch_room_occ'], params_occ)
        data_occ = process_branch_room_occ(df_occ)
        upload_to_supabase('branch_room_occ', data_occ)
        
        # 2. yolo_prices (2026-01-01 ~ 오늘)
        print("\n[2/4] yolo_prices 동기화")
        params_yolo = {
            'date.start': DATE_RANGES['yolo_prices']['start'],
            'date.end': DATE_RANGES['yolo_prices']['end']
            # branch는 쿼리 디폴트 값 사용
        }
        df_yolo = execute_redash_query(QUERIES['yolo_prices'], params_yolo)
        data_yolo = process_yolo_prices(df_yolo)
        upload_to_supabase('yolo_prices', data_yolo)
        
        # 3. price_guide (Google Sheets - 전체)
        print("\n[3/4] price_guide 동기화")
        df_guide = get_google_sheet_data()
        data_guide = process_price_guide(df_guide)
        upload_to_supabase('price_guide', data_guide)
        
        # 4. raw_bookings (2025-01-01 ~ 오늘) - 가장 큼!
        print("\n[4/4] raw_bookings 동기화 (대용량 - 시간 소요)")
        params_bookings = {
            'startDate': DATE_RANGES['raw_bookings']['start'],
            'endDate': DATE_RANGES['raw_bookings']['end']
            # branchId는 쿼리 디폴트 값 사용
        }
        df_bookings = execute_redash_query(QUERIES['raw_bookings'], params_bookings)
        data_bookings = process_raw_bookings(df_bookings)
        upload_to_supabase('raw_bookings', data_bookings)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n{'='*60}")
        print(f"✅ 동기화 완료! (소요시간: {duration:.1f}초 = {duration/60:.1f}분)")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ 동기화 실패: {str(e)}")
        print(f"{'='*60}\n")
        raise

if __name__ == '__main__':
    main()
