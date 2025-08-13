/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: {
        // Enable server actions
        allowedOrigins: ['localhost:3000'],
      },
    },
    output: 'standalone',
    // This ensures all required dependencies are included in the build
    transpilePackages: [],
    // Improve Docker compatibility
    poweredByHeader: false,
    reactStrictMode: true
}

export default nextConfig