/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optimize build performance
    experimental: {
        // Reduce memory usage during build
        workerThreads: false,
        cpus: 1,
    },

    // Disable source maps in production to save memory
    productionBrowserSourceMaps: false,

    // Optimize webpack
    webpack: (config, { isServer }) => {
        // Reduce memory usage
        config.optimization = {
            ...config.optimization,
            minimize: true,
            // Use single thread for terser to reduce memory
            minimizer: config.optimization.minimizer?.map((plugin) => {
                if (plugin.constructor.name === 'TerserPlugin') {
                    return {
                        ...plugin,
                        options: {
                            ...plugin.options,
                            parallel: false, // Disable parallel processing to save memory
                        },
                    };
                }
                return plugin;
            }),
        };

        return config;
    },
};

export default nextConfig;
