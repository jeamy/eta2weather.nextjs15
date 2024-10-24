import { Config } from "../Config";
import { Names2Id, Names2IdReader } from "../Names2Id";

export async function readNames2Id(config: Config): Promise<Names2Id> {
  const names2id = new Names2IdReader(config);
  const result = await names2id.readNames2Id();
  return result;
}
