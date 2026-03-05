app/page.tsx 수정 가이드
=======================

1. BRANCH_ROOMTYPES 상수 삭제 (더 이상 필요 없음)
   - 삭제: const BRANCH_ROOMTYPES: Record<string, string[]> = { ... }

2. fetchAllData 함수 수정:

BEFORE:
```typescript
if (selectedBranch !== '전지점') {
  const roomtype = await fetch(`/api/roomtype?branch=${selectedBranch}`).then(r => r.json())
  setRoomTypeData(roomtype)
  
  const types = BRANCH_ROOMTYPES[selectedBranch] || []
  if (types.length > 0 && !selectedRoomType) {
    setSelectedRoomType(types[0])
  }
}
```

AFTER:
```typescript
if (selectedBranch !== '전지점') {
  const roomtype = await fetch(`/api/roomtype?branch=${selectedBranch}`).then(r => r.json())
  setRoomTypeData(roomtype)
  
  // API에서 받은 roomTypes로 디폴트 선택
  if (roomtype.roomTypes && roomtype.roomTypes.length > 0) {
    setSelectedRoomType(roomtype.roomTypes[0])
  }
}
```

3. 룸타입 버튼 렌더링 수정:

BEFORE:
```typescript
const roomTypes = selectedBranch === '전지점' ? [] : (BRANCH_ROOMTYPES[selectedBranch] || [])

{roomTypes.length > 0 && (
  <div className="flex gap-2 mb-4 flex-wrap">
    {roomTypes.map(rt => (
      <button ...>{rt}</button>
    ))}
  </div>
)}
```

AFTER:
```typescript
{selectedBranch !== '전지점' && roomTypeData?.roomTypes && (
  <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
    <h2 className="text-xl font-bold mb-4">룸타입별 성과</h2>
    <div className="flex gap-2 mb-4 flex-wrap">
      {roomTypeData.roomTypes.map((rt: string) => (
        <button
          key={rt}
          onClick={() => setSelectedRoomType(rt)}
          className={`px-4 py-2 rounded ${
            selectedRoomType === rt
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          {rt}
        </button>
      ))}
    </div>
    <div className="h-96">
      <canvas ref={roomTypeChartRef}></canvas>
    </div>
  </div>
)}
```

핵심 변경사항:
- BRANCH_ROOMTYPES 하드코딩 제거
- API에서 받은 roomTypes 사용
- 디폴트로 첫 번째 룸타입 자동 선택
