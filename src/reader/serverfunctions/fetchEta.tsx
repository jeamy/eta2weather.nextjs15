'use server';

import { Config } from "../Config";
import { EtaData, FetchEta } from "../EtaData";
import { Names2Id } from "../Names2Id";
import { NextApiRequest, NextApiResponse } from 'next';


export async function fetchEtaData(config: Config, names2id: Names2Id): Promise<EtaData> {
    const eta = new FetchEta(config, names2id);
    const data = await eta.fetchEtaData();
    return data;
}
