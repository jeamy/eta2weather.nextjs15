'use server';

import { Config, ConfigReader } from "../Config";

export async function readConfig(fconfig: string): Promise<Config> {
    const config = new ConfigReader(fconfig);

    const result = await config.readConfig();
    return result;
}
