import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dispatch } from "@/server/http/runtime";

const port = Number(process.env.PORT ?? 3001);

function headerPairs(req: IncomingMessage): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) pairs.push([key, value.join(", ")]);
    else pairs.push([key, value]);
  }
  return pairs;
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost:${port}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
  return new Request(`http://${host}${req.url ?? "/"}`, {
    method,
    headers: headerPairs(req),
    body,
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  try {
    const response = await dispatch(await toRequest(req));
    await writeResponse(res, response);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { code: "INTERNAL", message: "Lỗi máy chủ." } }));
  }
});

server.listen(port, () => {
  console.log(`AccessLink API (dữ liệu demo, nhãn mô phỏng) http://localhost:${port}`);
});
