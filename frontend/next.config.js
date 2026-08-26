/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [
      { source: '/server', destination: '/console/dashboard', permanent: true },
      { source: '/server/login', destination: '/console', permanent: true },
      { source: '/server/dashboard', destination: '/console/dashboard', permanent: true },
      { source: '/server/dashboard/:path*', destination: '/console/dashboard/:path*', permanent: true },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  },
  webpack: (config, { dev }) => {
    // Docker on Windows bind mounts don't propagate inotify events reliably.
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**'],
      };
    }
    return config;
  },
}

module.exports = nextConfig
