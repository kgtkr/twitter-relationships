import * as t from "io-ts";
import lazyValue from "lazy-value";
import yaml from "js-yaml";
import * as fs from "fs-extra";
import { eitherUnwrap } from "./utils";
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
  const data = yaml.safeLoad(text);
  return pipe(
    configType.decode(data),
    E.getOrElse((_e): Config => {
      throw new Error("Invalid config.yaml");
    })
  );
}
