/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Transparently proxies /requisition through to the separate
    // shuletech-requisitions deployment, so it's reachable at
    // exams.shuletechsolutions.co.ke/requisition without a new subdomain or
    // DNS change. That app sets basePath: '/requisition' itself, so its own
    // page routes and _next static assets already carry the right prefix -
    // this just needs to forward the whole path space through unchanged.
    // Set REQUISITIONS_APP_URL in this project's Vercel env once that app
    // has a real deployment URL (defaults to a placeholder until then).
    const requisitionsAppUrl = process.env.REQUISITIONS_APP_URL || 'https://shuletech-requisitions.vercel.app'
    return [
      { source: '/requisition', destination: `${requisitionsAppUrl}/requisition` },
      { source: '/requisition/:path*', destination: `${requisitionsAppUrl}/requisition/:path*` },
    ]
  },
}

module.exports = nextConfig
