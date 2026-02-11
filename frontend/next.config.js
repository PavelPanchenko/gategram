/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Уникальный buildId при каждой сборке — после деплоя браузер тянет новый JS, меньше шанс "Failed to find Server Action x"
  generateBuildId: async () => process.env.BUILD_ID || `build-${Date.now()}`,
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
