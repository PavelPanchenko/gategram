/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Стабильный buildId из CI; без BUILD_ID — дефолт Next.js (хеш сборки)
  ...(process.env.BUILD_ID ? { generateBuildId: async () => process.env.BUILD_ID } : {}),
  // После деплоя не кешировать HTML/RSC — меньше шанс "Failed to find Server Action"
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
