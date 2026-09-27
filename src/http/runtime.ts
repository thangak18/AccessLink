import { buildSnapshotS0 } from "../../fixtures/demo-a/model";
import type { AccessPlanner } from "../contracts/types";
import { createDemoApp, type DemoApp } from "./demo-api";

let app: DemoApp | null = null;

export function getDemoApp(): DemoApp {
  if (!app) {
    app = createDemoApp({
      seed: buildSnapshotS0,
      auth: {
        operatorToken: process.env.DEMO_OPERATOR_TOKEN ?? "",
        reviewerToken: process.env.DEMO_REVIEWER_TOKEN ?? "",
      },
    });
  }
  return app;
}

export function dispatch(request: Request): Promise<Response> {
  return getDemoApp().dispatch(request);
}

export function setAccessPlanner(planner: AccessPlanner): void {
  getDemoApp().setPlanner(planner);
}
