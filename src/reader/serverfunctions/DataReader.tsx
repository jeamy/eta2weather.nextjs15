'use server';

import { Data } from "../../redux/dataSlice";
import { DataReader } from "../Data";

export async function readData(fdata: string): Promise<Data> {
    // ... //
    const reader = new DataReader(fdata);
    const result = await reader.readData();
    return result;
}

