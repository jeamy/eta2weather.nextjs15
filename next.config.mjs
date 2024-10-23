/** @type {import('next').NextConfig} */

import dotenv from 'dotenv';
import { loadEnvConfig } from '@next/env';

dotenv.config();

const nextConfig = {
    env: loadEnvConfig(process.cwd()),
};


export default nextConfig;
