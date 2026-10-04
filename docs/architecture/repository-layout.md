# Cấu trúc repository AccessLink

Cập nhật 04/10/2026. Đây là bố trí mã nguồn thực tế trên nhánh `Thang`; giữ kiến trúc modular monolith và URL/API hiện có. Không có một cấu trúc duy nhất cho mọi dự án: cách chia này theo trách nhiệm và quy ước Next.js, phù hợp đội bốn người.

## Cây thư mục

```text
AccessLink/
├── src/
│   ├── app/                         # Next.js pages, layout, styles, API route adapters
│   ├── features/
│   │   └── access-explorer/          # Web khách: components, API client, types, fixture adapter
│   ├── components/
│   │   └── map/                     # Map dùng chung cho khách và admin
│   ├── contracts/                   # DTO/types dữ liệu, engine và bản đồ dùng chung
│   ├── domain/                      # Lỗi nghiệp vụ dùng chung
│   ├── modules/                     # Places, evidence, review-publication
│   ├── infrastructure/
│   │   └── db/                      # Repository, PostgreSQL adapter, SQL migrations
│   ├── server/
│   │   ├── http/                    # Dispatch, xác thực demo, khởi tạo runtime
│   │   └── index.ts                 # Entrypoint server API độc lập
│   └── demo/
│       └── demo-a/                  # Bộ sinh TypeScript, thông báo, đáp án mẫu
├── data/
│   └── demo/demo-a/                 # Snapshot JSON và GeoJSON được sinh ra
├── tests/
│   ├── unit/                       # Fixtures, client contracts/version guards
│   ├── integration/                # HTTP/publication với repository trong bộ nhớ
│   └── e2e/                        # Playwright trên trình duyệt
├── scripts/
│   ├── build/                      # Đóng gói standalone/static assets
│   ├── database/                   # Seed demo vào PostgreSQL
│   └── demo/                       # Xuất fixtures, quay video demo
├── docs/
│   ├── README.md                   # Mục lục tài liệu
│   ├── product/                    # Proposal, nhu cầu và phạm vi sản phẩm
│   ├── architecture/               # Requirements, kiến trúc, hướng dẫn cấu trúc repo
│   ├── project/                    # Phân công và timeline
│   ├── demo/                       # Kịch bản dữ liệu và trình bày
│   ├── handoffs/                   # Bàn giao giữa các thành viên
│   └── submissions/                # PDF đã chuẩn bị gửi BTC
├── artifacts/
│   ├── screenshots/                # Ảnh giao diện đã chọn để bàn giao
│   └── videos/                     # Video demo đã chọn để bàn giao
├── README.md
├── CONTRIBUTING.md
├── package.json / package-lock.json
├── next.config.ts / tsconfig.json
├── vitest.config.ts / playwright.config.ts
└── Dockerfile / docker-compose.yml / .env.example
```

Các file cấu hình công cụ, `.env.*`, `AGENTS.md`, `CLAUDE.md` giữ ở gốc. Không tạo `public/`, `core/`, `admin/` hay `ai/` rỗng; thêm khi có mã/tài nguyên tương ứng. `tmp/`, `.next/`, `node_modules/`, coverage và kết quả kiểm thử tự sinh không đưa vào Git.

## Ranh giới trách nhiệm

- `app/` nối route với giao diện/use case; không đặt toàn bộ nghiệp vụ trong route handler.
- `features/access-explorer/` chứa phần riêng của màn hình khách. Bảo có thể thêm feature `operator-console/` khi xây admin; giữ map dùng chung ở `components/map/`.
- `components/` dùng các kiểu dữ liệu ở `contracts/`; không import ngược từ một feature cụ thể. Component map không tự gọi API hoặc publish.
- `modules/` chứa nghiệp vụ; truy cập lưu trữ qua repository interface. `server/` chứa HTTP/runtime và entrypoint Node. Feature trình duyệt không import `server/` hoặc adapter database.
- `contracts/` chỉ chứa kiểu dữ liệu/hợp đồng dùng chung, không phụ thuộc UI/module triển khai. Một số module vẫn re-export kiểu cũ để giảm gián đoạn tích hợp.
- `src/demo/` là mã sinh dữ liệu mô phỏng dùng lại bởi UI demo, API demo, seed và test. `data/demo/` là bản xuất JSON/GeoJSON. Sửa nguồn TypeScript rồi chạy `npm run emit:fixtures`, không chỉ sửa JSON.
- Migration vẫn ở `src/infrastructure/db/migrations/` để adapter đọc SQL theo vị trí module. Lệnh seed được đưa ra `scripts/database/` vì đó là thao tác vận hành.
- `artifacts/` chỉ chứa bản bàn giao được chọn. Video/ảnh kiểm thử tạm để trong `tmp/` hoặc `test-results/`.

## Imports

Alias `@/` trỏ tới `src/` qua `tsconfig.json`; Vitest khai báo alias tương ứng. Next.js và `tsx` đọc cấu hình TypeScript này. Giữ đường dẫn tương đối cho tài nguyên được đọc qua filesystem, ví dụ SQL migration; alias import không thay thế đường dẫn `readFile`.

```ts
import { AccessExplorer } from "@/features/access-explorer/components/access-explorer";
import type { LayerData, MapSelection } from "@/contracts/map";
import { buildSnapshotS0 } from "@/demo/demo-a/model";
```

## Đường dẫn cũ → mới để thành viên chuyển nhánh

| Trước | Sau |
|---|---|
| `TASCO_AccessLink_Proposal.md` | `docs/product/proposal.md` |
| `TASCO_AccessLink_Requirements_Architecture.md` | `docs/architecture/requirements.md` |
| `TASCO_AccessLink_Kich_Ban_Mock_Data.md` | `docs/demo/mock-data.md` |
| `TASCO_AccessLink_Phan_Cong_NexRoute.md` | `docs/project/team-plan.md` |
| `docs/THANG_HANDOFF.md` | `docs/handoffs/thang.md` |
| `docs/THANG_DEMO_SCRIPT.md` | `docs/demo/presentation-script.md` |
| `src/components/public/access-explorer.tsx` | `src/features/access-explorer/components/access-explorer.tsx` |
| `src/lib/public/` | `src/features/access-explorer/` (`contracts.ts` → `types.ts`, `scenarios.ts` → `fixtures.ts`) |
| `src/http/`, `src/server.ts` | `src/server/http/`, `src/server/index.ts` |
| `fixtures/demo-a/*.ts` | `src/demo/demo-a/*.ts` |
| `fixtures/demo-a/*.json`, `*.geojson` | `data/demo/demo-a/` |
| `output/pdf/` | `docs/submissions/` |
| `output/screenshots/`, `output/video/` | `artifacts/screenshots/`, `artifacts/videos/` |

Bảng này giữ tên cũ để tra cứu lịch sử; những tên này không còn là đường dẫn hoạt động. Khi ghép nhánh Tú/Kiên/Bảo, áp dụng thay đổi nghiệp vụ lên vị trí mới và kiểm tra lại import, tránh tạo lại bản sao file ở thư mục cũ.

## Lệnh sử dụng

Các lệnh người dùng giữ nguyên: `npm run dev`, `npm run dev:api`, `npm run seed:demo`, `npm run emit:fixtures`, `npm run demo:record`, `npm test`, `npm run build`, `npm start`.

Thêm `npm run test:unit` và `npm run test:integration` để chạy từng nhóm. `npm run typecheck` sinh types Next.js trước khi kiểm tra, dùng được cả sau clone mới. `npm run test:e2e` bật server tạm phục vụ kiểm thử và tự dừng khi kết thúc nếu Playwright là bên khởi tạo.

Việc sắp xếp này không bổ sung engine, sửa lỗi nghiệp vụ đã review của Tú hoặc nối PostgreSQL vào runtime. Các giới hạn sản phẩm vẫn như [bàn giao Thang](../handoffs/thang.md).

## Kiểm tra sau sắp xếp — 04/10/2026

- 15/15 unit/integration tests, TypeScript và production build đạt.
- 8/8 Playwright tests chạy trên production standalone ở cổng kiểm thử riêng; server kiểm thử đã tự dừng.
- Đã rà toàn bộ link Markdown nội bộ của tài liệu hiện có: không có link hỏng.
- 10 file dữ liệu/bản xuất (JSON, GeoJSON, PDF, ảnh, video) có checksum trùng với trước khi di chuyển.
- Lệnh seed khởi động được từ vị trí mới trong chế độ không cấu hình database; chưa kiểm thử PostgreSQL thực.
