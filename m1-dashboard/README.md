# M1버프 현황판

호텔 예약 현황 실시간 대시보드

## 🚀 배포 방법

### 1. Supabase 설정
1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase-schema.sql` 실행
3. Project URL과 Anon Key 복사

### 2. GitHub 레포지토리 생성
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 3. Vercel 배포
1. [Vercel](https://vercel.com) 로그인
2. "New Project" 클릭
3. GitHub 레포지토리 선택
4. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key  
   - `SYNC_API_SECRET`: 랜덤 문자열 (Google Apps Script용)
5. Deploy 클릭

### 4. Google Apps Script 동기화 설정
1. Google Sheets Apps Script에서 `SYNC_TO_SUPABASE()` 함수 생성
2. Vercel URL 설정: `https://your-app.vercel.app/api/sync`
3. 트리거 설정: 매시간 자동 실행

## 📁 프로젝트 구조
```
m1-dashboard/
├── app/
│   ├── api/
│   │   ├── daily/route.ts      # 오늘 실적 API
│   │   ├── monthly/route.ts    # 월 누적 API
│   │   ├── weekly/route.ts     # 최근 7일 API
│   │   └── sync/route.ts       # 동기화 API
│   ├── page.tsx                # 메인 대시보드
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   └── supabase.ts            # Supabase 클라이언트
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🔄 데이터 동기화

Raw 데이터는 Google Sheets에서 관리하고, Apps Script로 Supabase에 자동 동기화됩니다.

### 동기화 테이블:
- `raw_bookings` - 예약 데이터
- `branch_room_occ` - OCC 데이터
- `price_guide` - 가드레일
- `yolo_prices` - 셋팅가
- `targets` - 목표 매출

## 📊 API 엔드포인트

- `GET /api/daily?branch=all` - 오늘 실적
- `GET /api/monthly?branch=all` - 월 누적
- `GET /api/weekly?branch=all` - 최근 7일
- `POST /api/sync` - 데이터 동기화 (Apps Script 전용)

## 🔐 환경 변수

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SYNC_API_SECRET=your-secret-token
```
