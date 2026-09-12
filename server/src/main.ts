import { buildRuntimeConfig } from "./core/config.js";
import { loadDotEnv, startNodeServer } from "./adapters/node-server.js";

loadDotEnv();

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必须是 1-65535 的整数");
}
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");

const config = buildRuntimeConfig(process.env);
startNodeServer(config, { host, port });
