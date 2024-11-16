/**
 * Ecowitt API Configuration Example
 * 
 * How to get your API credentials:
 * 
 * 1. Create an Ecowitt Account:
 *    - Go to https://www.ecowitt.net/
 *    - Click "Register" and complete the registration process
 * 
 * 2. Get Your Application Key:
 *    - Log in to your Ecowitt account
 *    - Go to "Settings" > "API Settings"
 *    - Your Application Key will be listed there
 * 
 * 3. Generate API Key:
 *    - In "API Settings", click "Generate API Key"
 *    - Save this key securely - it cannot be retrieved later
 * 
 * 4. Find Your Device MAC:
 *    - Go to "Devices" in your Ecowitt dashboard
 *    - Select your weather station
 *    - The MAC address will be listed in the device details
 * 
 * Security Notes:
 * - Never commit the actual API keys to version control
 * - Use environment variables or secure key management in production
 * - Keep your API keys confidential
 */

export const EcowittConfig = {
  config: {
    applicationKey: "XXX", // Your Ecowitt Application Key
    apiKey: "XXX",        // Your Generated API Key
    mac: "XXX",           // Your Device MAC Address
    server: "api.ecowitt.net"
  }
};

/**
 * Usage Example:
 * 
 * 1. Copy this file to 'eco.tsx'
 * 2. Replace 'XXX' with your actual credentials
 * 3. Import and use in your components:
 * 
 * import { EcowittConfig } from '@/config/eco';
 * 
 * const apiUrl = `https://${EcowittConfig.config.server}/api/v3/device/real_time`;
 * const params = {
 *   application_key: EcowittConfig.config.applicationKey,
 *   api_key: EcowittConfig.config.apiKey,
 *   mac: EcowittConfig.config.mac,
 *   call_back: 1
 * };
 */
