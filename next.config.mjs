import path from 'path';

const projectRoot = path.dirname(new URL(import.meta.url).pathname);

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable source maps in production to save memory
    productionBrowserSourceMaps: false,

    // Enable Turbopack and set explicit root to avoid workspace root mis-detection
    turbopack: {
        root: projectRoot,
    },

    // Keep webpack config for backward compatibility
    // (will be ignored when using Turbopack)
    webpack: (config, { isServer }) => {
        // This is only used if explicitly running with --webpack flag
        config.optimization = {
            ...config.optimization,
            minimize: true,
            splitChunks: {
                ...config.optimization.splitChunks,
                maxAsyncRequests: 5,
                maxInitialRequests: 3,
            },
        };

        config.performance = {
            ...config.performance,
            hints: false,
        };

        return config;
    },
};

export default nextConfig;
