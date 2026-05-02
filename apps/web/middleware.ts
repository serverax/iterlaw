import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  await supabase.auth.getSession()
  const protectedRoutes = ['/dashboard', '/questions', '/cases']
  const pathname = request.nextUrl.pathname
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }
  if (pathname === '/auth/login') {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  return response
}
export const config = {
  matcher: ['/dashboard/:path*', '/questions/:path*', '/cases/:path*', '/auth/login'],
}
