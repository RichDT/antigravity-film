/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // The old Vercel address forwards every path to the custom domain
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'antigravity-film.vercel.app' }],
        destination: 'https://www.richpicks.app/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
