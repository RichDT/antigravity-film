import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Being signed in isn't enough: only the admin role may use admin pages and APIs (members can't)
  let isAdmin = false
  if (user) {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    isAdmin = data?.role === 'admin'
  }

  // Admin API routes write to the database — refuse them outright without the admin role
  if (!isAdmin && request.nextUrl.pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: user ? 'Forbidden' : 'Unauthorized' }, { status: user ? 403 : 401 })
  }

  // Admin pages without the admin role go to the login page
  if (
    !isAdmin &&
    request.nextUrl.pathname.startsWith('/admin') &&
    !request.nextUrl.pathname.startsWith('/admin/login')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
