import { buildSnapshotS0 } from "../../fixtures/demo-a/model";
import type { AccessPlanner } from "../contracts/types";
import { DomainError } from "../domain/errors";
import { MemoryDatasetRepository } from "../infrastructure/db/memory-repository";
import type { DatasetRepository } from "../infrastructure/db/repository";
import { PlaceCatalog } from "../modules/places/catalog";
import { parseBody, resetBody } from "../modules/review-publication/schema";
import { PublicationService, type Actor } from "../modules/review-publication/service";

export type DemoAuth = {
  operatorToken: string;
  reviewerToken: string;
};

export type DemoApp = {
  dispatch(request: Request): Promise<Response>;
  setPlanner(planner: AccessPlanner | null): void;
  publication: PublicationService;
  catalog: PlaceCatalog;
  repo: DatasetRepository;
};

export function createDemoApp(options: {
  repo?: DatasetRepository;
  planner?: AccessPlanner | null;
  clock?: () => string;
  auth: DemoAuth;
  seed?: () => ReturnType<typeof buildSnapshotS0>;
}): DemoApp {
  const seed = options.seed ?? buildSnapshotS0;
  const repo = options.repo ?? new MemoryDatasetRepository(seed());
  const publication = new PublicationService({
    repo,
    planner: options.planner ?? null,
    clock: options.clock ?? (() => new Date().toISOString()),
    seed,
  });
  const catalog = new PlaceCatalog(repo);
  const app: DemoApp = {
    publication,
    catalog,
    repo,
    setPlanner(planner) {
      publication.setPlanner(planner);
    },
    dispatch(request) {
      return handle(request, { catalog, publication, auth: options.auth });
    },
  };
  return app;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function handle(
  request: Request,
  ctx: { catalog: PlaceCatalog; publication: PublicationService; auth: DemoAuth },
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "") || "/";
    const result = await route(request, url, pathname, ctx);
    return json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return json(
        { error: { code: error.code, message: error.message, ...error.details } },
        error.status,
      );
    }
    console.error(error);
    return json({ error: { code: "INTERNAL", message: "Lỗi máy chủ." } }, 500);
  }
}

function actorFrom(request: Request, auth: DemoAuth): Actor {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new DomainError("UNAUTHORIZED", "Cần đăng nhập.", 401);
  if (auth.reviewerToken && match[1] === auth.reviewerToken) return { id: "reviewer_demo", role: "reviewer" };
  if (auth.operatorToken && match[1] === auth.operatorToken) return { id: "operator_demo", role: "operator" };
  throw new DomainError("UNAUTHORIZED", "Token không hợp lệ.", 401);
}

function requireMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw new DomainError("METHOD_NOT_ALLOWED", `Dùng ${method}.`, 405);
  }
}

function versionParam(url: URL): number | null {
  const raw = url.searchParams.get("version");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new DomainError("VALIDATION", "version phải là số nguyên dương.", 400);
  }
  return value;
}

function datasetParam(url: URL): string {
  const datasetId = url.searchParams.get("dataset_id");
  if (!datasetId) throw new DomainError("VALIDATION", "Thiếu dataset_id.", 400);
  return datasetId;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DomainError("INVALID_JSON", "Body JSON không hợp lệ.", 400);
  }
}

async function route(
  request: Request,
  url: URL,
  pathname: string,
  ctx: { catalog: PlaceCatalog; publication: PublicationService; auth: DemoAuth },
): Promise<unknown> {
  if (pathname === "/api/v1/places") {
    requireMethod(request, "GET");
    return ctx.catalog.list(datasetParam(url), url.searchParams.get("q"), versionParam(url));
  }

  const place = /^\/api\/v1\/places\/([^/]+)$/.exec(pathname);
  if (place) {
    requireMethod(request, "GET");
    return ctx.catalog.get(datasetParam(url), decodeURIComponent(place[1]), versionParam(url));
  }

  if (pathname === "/api/v1/access-layer") {
    requireMethod(request, "GET");
    return ctx.catalog.layer(
      datasetParam(url),
      versionParam(url),
      url.searchParams.get("bbox"),
      url.searchParams.get("at"),
    );
  }

  const version = /^\/api\/v1\/datasets\/([^/]+)\/version$/.exec(pathname);
  if (version) {
    requireMethod(request, "GET");
    return ctx.catalog.version(decodeURIComponent(version[1]));
  }

  if (pathname === "/api/v1/reports") {
    requireMethod(request, "POST");
    return ctx.publication.createReport(await readJson(request));
  }

  if (pathname === "/api/v1/admin/reports") {
    requireMethod(request, "GET");
    return {
      reports: await ctx.publication.listReports(datasetParam(url), actorFrom(request, ctx.auth)),
    };
  }

  if (pathname === "/api/v1/admin/changesets") {
    requireMethod(request, "POST");
    return ctx.publication.createChangeset(await readJson(request), actorFrom(request, ctx.auth));
  }

  const preview = /^\/api\/v1\/admin\/changesets\/([^/]+)\/preview$/.exec(pathname);
  if (preview) {
    requireMethod(request, "POST");
    return ctx.publication.preview(decodeURIComponent(preview[1]), await readJson(request), actorFrom(request, ctx.auth));
  }

  const publish = /^\/api\/v1\/admin\/changesets\/([^/]+)\/publish$/.exec(pathname);
  if (publish) {
    requireMethod(request, "POST");
    return ctx.publication.publish(decodeURIComponent(publish[1]), actorFrom(request, ctx.auth));
  }

  const changeset = /^\/api\/v1\/admin\/changesets\/([^/]+)$/.exec(pathname);
  if (changeset) {
    requireMethod(request, "PATCH");
    return ctx.publication.patchChangeset(
      decodeURIComponent(changeset[1]),
      await readJson(request),
      actorFrom(request, ctx.auth),
    );
  }

  const reset = /^\/api\/v1\/admin\/datasets\/([^/]+)\/reset$/.exec(pathname);
  if (reset) {
    requireMethod(request, "POST");
    const body = parseBody(resetBody, await readJson(request));
    return ctx.publication.reset(decodeURIComponent(reset[1]), body.confirm, actorFrom(request, ctx.auth));
  }

  throw new DomainError("NOT_FOUND", "Không có endpoint này.", 404);
}
