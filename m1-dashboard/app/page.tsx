// app/page.tsx에서 수정할 부분

// 1. roomTypeData 상태에 roomTypes 추가
const [roomTypeData, setRoomTypeData] = useState<any>(null)

// 2. fetchAllData 함수에서
if (selectedBranch !== '전지점') {
  const roomtype = await fetch(`/api/roomtype?branch=${selectedBranch}`).then(r => r.json())
  setRoomTypeData(roomtype)
  
  // 디폴트로 첫 번째 룸타입 선택
  if (roomtype.roomTypes && roomtype.roomTypes.length > 0) {
    setSelectedRoomType(roomtype.roomTypes[0])
  }
}

// 3. 룸타입 버튼 부분 수정
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
