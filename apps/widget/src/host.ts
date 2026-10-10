import { App } from "@modelcontextprotocol/ext-apps";
type Listener = (data: any) => void;
let app: App | null = null;
let development = false;
let identity = "player";
export function setIdentity(value: string) {
  identity = value;
}
export async function connectHost(onResult: Listener) {
  if (window.parent !== window) {
    app = new App(
      { name: "Lemon Empire", version: "0.1.0" },
      {},
      { autoResize: true },
    );
    app.ontoolresult = (p) => onResult(p.structuredContent);
    await app.connect();
    return "host";
  }
  const config = await fetch("/dev-config").then((r) => r.json());
  development = config.development;
  if (!development)
    throw new Error(
      "Open this game inside your authenticated ChatGPT connection.",
    );
  return "development";
}
export async function callTool(name: string, args: unknown): Promise<any> {
  let result: any;
  if (app) {
    const response = await app.callServerTool({
      name,
      arguments: args as Record<string, unknown>,
    });
    result = response.structuredContent;
    if (!result)
      throw new Error(
        response.content
          .filter((x) => x.type === "text")
          .map((x) => x.text)
          .join(" "),
      );
  } else {
    if (!development) throw new Error("Connection is not ready");
    const r = await fetch("/v1/tools/" + name, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer dev:" + identity,
      },
      body: JSON.stringify(args),
    });
    result = await r.json();
    if (!r.ok)
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : (result.error?.message ?? "Request failed"),
      );
  }
  if (result.ok === false) throw new Error(result.error.message);
  return result;
}
export async function askMentor(question: string) {
  if (app) {
    await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: question }],
    });
    return true;
  }
  return false;
}
