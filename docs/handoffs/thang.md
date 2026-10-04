# Thang — Giao diện khách và bản đồ AccessLink

Ngày triển khai: 01/10/2026. Nhánh `Thang` dựa trên commit `72ab59c` của `Tu`; giữ lịch sử tác giả. Không gộp vào `main` trong lần bàn giao này.

## Chạy ứng dụng

```sh
npm ci
npm run dev
```

Mở http://localhost:3000. API của Tú chạy cùng Next.js qua catch-all route; không cần mở `dev:api` riêng. `npm run build` rồi `npm start` để chạy bản production. Node >=20.9. Tài liệu Next.js: https://nextjs.org/docs/app/getting-started/installation

Bản đồ dùng Leaflet 1.9: https://leafletjs.com/reference.html. Mặc định hiển thị lớp GeoJSON tương tác trên nền sơ đồ, kéo/zoom/chọn được, không cần mạng tải tiles. Nút nền địa lý tải OpenStreetMap có attribution; tọa độ fixture chỉ minh họa, không trùng vị trí thật. Không bulk download/cache tiles offline. Chưa có tích hợp SDK Goong do chưa có key/phạm vi được cấp; không tuyên bố đây là demo VMAP chính thức.

## Đã triển khai

- Next.js App Router, TypeScript, scripts dev/build/start, cấu hình container standalone.
- Web responsive, tìm địa điểm có/không dấu, chọn địa điểm từ danh sách hoặc marker, deep link `/?place=place_b`.
- Hai phương tiện, điểm xuất phát trong cụm và giờ GMT+7; chế độ fixture chỉ cho truy vấn có đáp án.
- Bản đồ lớp cửa/đường nối/địa điểm/gửi xe/vùng demo, lựa chọn đối tượng, tuyến xe máy và đi bộ phân biệt.
- Các trạng thái available/needs_verification/no_plan_found; tải dữ liệu, lỗi, rỗng, engine chưa có, nút thử lại.
- Nhãn dữ liệu mô phỏng; nguồn/ngày duyệt/hạn kiểm tra/quan sát thực địa được trình bày đúng trường dữ liệu.
- Chế độ API đọc version rồi yêu cầu layer/catalog/plan cùng version, từ chối lệch version/place/mode; hủy truy vấn cũ và kiểm tra thứ tự phản hồi.
- Poll version 5 giây; đồng hồ demo tùy chọn tiến theo phút; nếu engine trả `next_recompute_at`, UI hẹn tải lại ở mốc đó. Khi người dùng giữ giờ cố định, đây là truy vấn thời gian cố định, không tự chuyển sang giờ hệ thống.
- Phản ánh trong chế độ API gửi endpoint của Tú; chế độ mẫu chỉ minh họa trên UI và nói rõ chưa gửi server.
- Script quay video fixture thật từ trình duyệt và kịch bản pitch trung thực về phần chưa có engine.

## Hai chế độ không được đánh đồng

**Kịch bản mẫu:** đọc `expectedPlans()` của Tú, không tính đường. S0 A=90m; S1 A=200m/B=215m; S2 A/B không có lối; S3 A xe máy không có lối nhưng đi bộ=190m; S4 dùng G3; S5 giữ S1. Query ngoài bảng đáp án trả “chưa có đáp án”, không bịa đường. Video chế độ này chỉ chứng minh UI hiển thị dữ liệu mẫu.

**API tích hợp:** gọi `POST /api/v1/access-plans`; hiện nhánh Tu chưa có endpoint nên UI báo đang chờ Kiên. Không tự chuyển sang mẫu. Khi có engine sẽ dùng kết quả engine. Các lỗi ở backend Tú đã được review vẫn cần Tú xử lý; nhánh này không sửa thay module publish/evidence.

## Hợp đồng giao cho Kiên

Request: `{dataset_id, data_version, place_id, origin_node_id, mode, purpose, depart_at}`. `data_version` pin snapshot cùng lớp bản đồ. Nếu API không hỗ trợ pin, UI vẫn kiểm tra version trả về và ẩn kết quả không khớp.

Response tối thiểu theo `PlanResult` của Tú: `data_version`, `data_kind`, `place_id`, `mode`, `route_status`, `walk_length_m`, `legs[]` với edge/from/to/mode/length, `limitations[]`. Mỗi `edge_id` cần tồn tại trong layer. `walk_length_m` không phải khoảng cách đo từ các tọa độ minh họa.

Các trường bổ sung cho UI: `evaluated_at`, `next_recompute_at` (ISO có timezone, mốc tiếp theo của truy vấn), `destination_node_id`, `evidence[]`. Khi chưa có evidence API, UI báo thiếu nguồn chứ không đánh dấu đã xác minh. Contract chỉ ở `src/features/access-explorer/types.ts`, không sửa `src/contracts/types.ts` của Tú. Kiên cần review contract này trước tích hợp.

## Component bản đồ giao cho Bảo

`src/components/map/access-map.tsx` export default AccessMap và AccessMapProps:

```tsx
const AccessMap = dynamic(() => import('@/components/map/access-map'), { ssr: false });
<AccessMap layer={layer} plan={planOrNull} mode="walk"
  selectedIds={["node/G2", "edge/e05"]}
  onSelect={({ featureId, type, id, label }) => setSelection({ featureId, type, id, label })} />
```

Các kiểu dữ liệu dùng chung của map nằm ở `src/contracts/map.ts`, không phụ thuộc riêng feature khách.

Layer nhận GeoJSON + version + flags từ API Tú. Callback không ghi/publish dữ liệu. Bảo sở hữu trang admin và luồng duyệt, có thể dùng map này để chọn mục tiêu. Không chèn nội dung API thành HTML.

## Kiểm tra và giới hạn triển khai

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
# Giữ app chạy ở localhost:3000:
npm run demo:record
```

Container: `docker build -t accesslink-thang .` và `docker run --rm -p 3000:3000 accesslink-thang`. Không chép `.env` vào image. Container chưa chứng minh persistent DB: runtime Tú hiện dùng bộ nhớ; restart sẽ mất thay đổi. Demo tích hợp cần một server duy nhất cho tới khi Tú nối PostgreSQL. Chưa triển khai public hosting hay test container runtime. Các giá trị admin token chỉ đưa vào môi trường server nếu cần chạy màn admin của Bảo, không đưa vào client.

Cần hoàn tất cùng nhóm: API engine của Kiên; nguồn/DB/khắc phục các lỗi của Tú; AI/admin của Bảo; tích hợp Goong theo điều kiện BTC; chạy trước–sau bằng publish thật; kiểm chứng đồng thời toàn bộ luồng; chốt hosting và video tích hợp cuối. Không đánh dấu nghiệm thu sản phẩm hoàn chỉnh chỉ từ video fixture.

## Kết quả kiểm tra 01/10/2026

- `npm test`: 15/15 (12 test kế thừa từ Tú, 3 test ranh giới tích hợp phía khách).
- `npm run typecheck`: đạt. `npm run build`: đạt. Production standalone đã chạy thử trên localhost:3003, tải được UI/static assets và API, không có JavaScript page error.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 8/8. Chạy trên Chrome cài sẵn; có thể bỏ biến này nếu đã tải Chromium của Playwright.
- Browser test kiểm tra S0/S1/S2/S3/S5, gửi phản ánh API, deep link, màn hình 360px không tràn ngang, phản hồi cũ đến muộn, route/map lệch version, đổi version thành công, lỗi mạng, needs_verification và mốc thời gian. Các bài test routing/version dùng response giả lập có kiểm soát khi engine chưa có; không thay thế nghiệm thu engine của Kiên.
- Kiểm tra trực quan desktop 1440px/mobile 360px; click marker B chuyển địa điểm; không ghi nhận JavaScript page error trong lượt kiểm tra trực quan.
- Video khoảng 20 giây: [UI fixture demo](../../artifacts/videos/AccessLink_Thang_UI_Fixture_Demo.webm). [Ảnh desktop](../../artifacts/screenshots/AccessLink_Thang_Desktop.png).
- Chưa benchmark hiệu năng tải lớn, chưa chạy PostgreSQL, Goong, container hoặc triển khai public hosting.
