import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // GitHub Actions workflow_dispatch 트리거
    const res = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/main.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    )

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`GitHub API ${res.status}: ${errorText}`)
    }

    console.log('Sync triggered successfully via Vercel Cron')
    return NextResponse.json({ success: true, triggered_at: new Date().toISOString() })
  } catch (error: any) {
    console.error('Trigger sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
