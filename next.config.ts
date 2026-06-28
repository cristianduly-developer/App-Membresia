import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false,
  disable: process.env.NODE_ENV === 'development',
  navigateFallbackDenylist: [/^\/ayuda/],
})

const nextConfig: NextConfig = {}

export default withSentryConfig(pwaConfig(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
})
