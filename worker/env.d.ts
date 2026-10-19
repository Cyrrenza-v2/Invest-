declare module "cloudflare:workers" {
  interface ProvidedEnv extends import("./index").Env {}
}
