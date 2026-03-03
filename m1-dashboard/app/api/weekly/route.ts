21:05:41.125 
   Creating an optimized production build ...
21:05:46.289 
 ✓ Compiled successfully
21:05:46.290 
   Linting and checking validity of types ...
21:05:52.400 
Failed to compile.
21:05:52.400 
21:05:52.401 
./app/api/weekly/route.ts:91:29
21:05:52.401 
Type error: Cannot find name 'end'.
21:05:52.401 
21:05:52.401 
  89 |     const days = []
21:05:52.401 
  90 |     for (let i = 6; i >= 0; i--) {
21:05:52.401 
> 91 |       const date = new Date(end)
21:05:52.401 
     |                             ^
21:05:52.401 
  92 |       date.setDate(date.getDate() - i)
21:05:52.401 
  93 |       const dateStr = date.toISOString().split('T')[0]
21:05:52.401 
  94 |       const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
21:05:52.454 
Error: Command "npm run build" exited with 1
