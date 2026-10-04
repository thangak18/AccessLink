# Làm việc cùng AccessLink

## Bắt đầu

Dùng Node >=20.9 và `npm ci`. Đọc [kiến trúc](docs/architecture/requirements.md), [cấu trúc repo](docs/architecture/repository-layout.md) và [phân công](docs/project/team-plan.md) trước khi chỉnh module chung.

Giữ thay đổi trên nhánh của thành viên/tính năng; phối hợp khi sửa DTO, migration, cấu hình gốc và lockfile. Nhánh `Thang` hiện chứa bố trí thư mục mới. Khi ghép nhánh cũ, dùng bảng đổi đường dẫn trong tài liệu cấu trúc để tránh file trùng.

## Quy ước

- Tên file/thư mục mã nguồn và Markdown mới: `kebab-case`; component/function/type giữ quy ước TypeScript đang dùng. Tên PDF/video đã bàn giao có thể giữ nguyên để nhận diện bản xuất.
- File route/layout/page giữ tên bắt buộc của Next.js. Cấu hình công cụ và `.env.*` nằm ở root.
- Import mã trong `src/` bằng `@/`. Không import database/runtime Node vào feature trình duyệt.
- Đặt mã riêng màn hình ở `features/<feature>/`; component dùng chung ở `components/`; hợp đồng dùng chung ở `contracts/`.
- Sửa dữ liệu mẫu tại `src/demo/`, rồi chạy `npm run emit:fixtures`; giữ nhãn mô phỏng. Không commit khóa API hay `.env` chứa thông tin thật.
- Tests chia `unit/`, `integration/`, `e2e/` theo mức kiểm tra; không gọi integration test trong bộ nhớ là đã kiểm chứng PostgreSQL.
- Tài liệu vào đúng nhóm trong `docs/`, cập nhật mục lục và link tương đối khi di chuyển. Chỉ đưa ảnh/video cần bàn giao vào `artifacts/`.

## Kiểm tra trước bàn giao

```sh
npm test
npm run typecheck
npm run build
# Khi thay đổi UI, đường dẫn import hoặc tích hợp:
npm run test:e2e
```

Cài trình duyệt bằng `npx playwright install chromium`, hoặc dùng Chrome đã cài: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

PR mô tả hành vi thay đổi, phần phụ thuộc/chưa hoàn tất và kiểm tra đã chạy. Không gộp thay đổi nghiệp vụ chưa liên quan vào một PR chỉ sắp xếp thư mục. Sau khi kiểm tra, tắt server tạm nếu không còn dùng để tiết kiệm pin.
