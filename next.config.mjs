/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable source maps in production to save memory
    productionBrowserSourceMaps: false,

    // Enable Turbopack with empty config (silences the warning)
    turbopack: {},

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
