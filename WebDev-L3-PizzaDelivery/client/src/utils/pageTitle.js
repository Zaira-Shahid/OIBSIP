const TITLES = {
  '/': 'Home',
  '/register': 'Create account',
  '/login': 'Log in',
  '/verify-email': 'Verify email',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/dashboard': 'Menu',
  '/builder': 'Build your pizza',
  '/order-summary': 'Order summary',
  '/orders': 'My orders',
  '/admin/login': 'Staff login',
  '/admin/dashboard': 'Admin dashboard',
  '/admin/inventory': 'Inventory',
  '/admin/orders': 'Orders',
}

// Browser tab / screen-reader title for a route, e.g. "My orders - Slice & Co.".
export function titleFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const name = TITLES[path] ?? (/^\/orders\/[^/]+$/.test(path) ? 'Order details' : 'Page not found')
  return `${name} - Slice & Co.`
}
