/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reduce risk of "Failed to find Server Action" after deploy: avoid long-lived cache of RSC
  async headers() {
    return [
      {
        source: '/((?!_next).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
