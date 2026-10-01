# AccessLink | Lối Tiếp Cận

**Đội NexRoute · MLAI Hackathon 2026 · Track TASCO**

Lớp bản đồ hỗ trợ người dùng tiếp cận địa điểm trong khu vực thi công: tìm cửa vào, đường nối, điểm gửi xe và chặng đi bộ phù hợp với phương tiện, thời gian.

## Trạng thái dự án

Nhánh `Thang` bổ sung web khách Next.js và bản đồ tương tác trên phần dữ liệu/API của Tú. Có tìm/chọn địa điểm, phương tiện, giờ, hiển thị chặng, nguồn, phản ánh và các trạng thái lỗi. Chế độ kịch bản hiển thị đáp án fixture có nhãn; chế độ API chờ engine của Kiên, không dùng đáp án mẫu thay thế. Chưa có engine thật, trang admin/AI, khảo sát thực địa hay kết quả thử nghiệm ngoài mock.

Dữ liệu trong repo là mô phỏng. Nhãn `is_simulated` không bị tắt khi duyệt vào demo.

```bash
npm ci
npm run dev
# http://localhost:3000
# npm run build && npm start: bản production
```

Web và API chạy cùng Next.js ở cổng 3000. API mặc định vẫn dùng bộ nhớ, chưa nối PostgreSQL trong runtime. Script cũ `npm run dev:api` chỉ chạy API ở cổng 3001. Cần `DEMO_OPERATOR_TOKEN` và `DEMO_REVIEWER_TOKEN` thì gọi được API admin. Có PostGIS thì `docker compose up -d` rồi `npm run seed:demo`.

Preview tuyến gọi `setAccessPlanner` do Kiên cung cấp. Khi engine chưa gắn, endpoint preview trả `PLANNER_UNAVAILABLE` và không đổi dữ liệu đã công bố.

## Bàn giao nhánh Thang

- [Hướng dẫn chạy, component map và hợp đồng tích hợp](docs/THANG_HANDOFF.md)
- [Kịch bản pitch và quay video fixture](docs/THANG_DEMO_SCRIPT.md)
- [Xem ảnh giao diện](output/screenshots/AccessLink_Thang_Desktop.png) · [Video UI dùng đáp án mẫu](output/video/AccessLink_Thang_UI_Fixture_Demo.webm)
- `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` để kiểm tra.
- `npm run demo:record` khi app đang chạy để quay video minh họa UI.

## Hồ sơ gửi BTC

- [Bản draft ý tưởng AccessLink (PDF, 4 trang)](output/pdf/NexRoute_AccessLink_01_Draft_Y_Tuong.pdf)
- [Kế hoạch tiếp theo và câu hỏi gửi BTC/TASCO (PDF, 3 trang)](output/pdf/NexRoute_AccessLink_02_Ke_Hoach_Tiep_Theo.pdf)

## Tài liệu thiết kế

- [Proposal](TASCO_AccessLink_Proposal.md)
- [Requirements và kiến trúc](TASCO_AccessLink_Requirements_Architecture.md)
- [Kịch bản mock data và hướng chuyển sang dữ liệu thật](TASCO_AccessLink_Kich_Ban_Mock_Data.md)

Đọc hồ sơ PDF để nắm phạm vi trình bày với BTC; đọc tài liệu mock để hiểu phương án prototype khi chưa thể khảo sát. Các lựa chọn kỹ thuật trong tài liệu là đề xuất triển khai.

## Vai trò thiết yếu của bản đồ

Kết quả phụ thuộc vị trí cửa, cấu trúc mạng đường, rào chắn, hướng đi và điều kiện phương tiện/thời gian. AccessLink dự kiến tính phương án tiếp cận từ các quan hệ này và thể hiện kết quả trực tiếp trên bản đồ.

Luồng demo: chọn địa điểm → nhận phương án → duyệt thông báo thay đổi lối đi → tính lại phương án của các địa điểm liên quan. Trong kịch bản giả lập, đóng G2 khiến A/B chuyển qua G3, còn C giữ tuyến riêng.

## Hướng công nghệ

Kiến trúc đề xuất: modular monolith; Next.js/TypeScript, PostgreSQL/PostGIS, engine mạng đường và quy tắc; adapter bản đồ và AI. API, hạn mức và cơ chế tích hợp với nền tảng TASCO cần xác nhận với BTC.

AI hỗ trợ trích xuất thông báo thành bản nháp. Người vận hành kiểm tra và duyệt; engine tính đường từ dữ liệu đã duyệt. Dữ liệu mô phỏng không dùng để dẫn đường thực tế.

## Tham chiếu

[Challenge Brief MLAI - TASCO](https://docs.google.com/document/d/11fRaBedWrh4XwWld9_dqoMTgj-lNi88Buzr5y3i0QOE/edit)

Nguồn đối chiếu và giới hạn bằng chứng được ghi trong proposal và hồ sơ PDF. Dự án chưa có xác nhận hợp tác hoặc tích hợp chính thức với TASCO.
