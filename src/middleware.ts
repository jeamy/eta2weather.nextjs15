import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function middleware(request: NextRequest) {
  // Only handle requests to /api/logs/...
  if (request.nextUrl.pathname.startsWith('/api/logs/')) {
    try {
      // Extract the file path from the URL and decode it
      const filePath = decodeURIComponent(request.nextUrl.pathname.replace('/api/logs/', ''))
      const fullPath = path.join(process.cwd(), 'public', 'log', filePath)

      // Verify the path is within the logs directory
      const normalizedPath = path.normalize(fullPath)
      const logsDir = path.join(process.cwd(), 'public', 'log')
      if (!normalizedPath.startsWith(logsDir)) {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 403 }
        )
      }

      // Read the file
      const fileContent = await fs.readFile(fullPath, 'utf-8')

      // Set appropriate headers based on file extension
      const headers = new Headers()
      if (fullPath.endsWith('.xml')) {
        headers.set('Content-Type', 'application/xml')
      } else if (fullPath.endsWith('.json')) {
        headers.set('Content-Type', 'application/json')
      }

      return new NextResponse(fileContent, {
        status: 200,
        headers,
      })
    } catch (error) {
      console.error('Error serving log file:', error)
      // Return 404 if file not found
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/logs/:path*',
}
