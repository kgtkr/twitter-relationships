import * as t from "io-ts";
import yaml from "js-yaml";
import { promises as fs } from "fs";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";

const tokenType = t.strict({
  ck: t.string,
  cs: t.string,
  tk: t.string,
  ts: t.string,
});

const configType = t.strict({
  accounts: t.array(
    t.strict({
      token: tokenType,
      discord_hook_url: t.string,
    })
  ),
  interval: t.number,
});

export type Config = t.TypeOf<typeof configType>;

export async function readConfig(): Promise<Config> {
  const text = await fs.readFile("config.yaml", "utf8");
  const data = yaml.load(text);
  return pipe(
    configType.decode(data),
    E.getOrElse((_e): Config => {
      throw new Error("Invalid config.yaml");
    })
  );
}
