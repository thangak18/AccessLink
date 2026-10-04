# AccessLink - Phân công triển khai đội NexRoute

**Ngày:** 26/09/2026  
**Hạn hoàn thành nội bộ:** 17/10/2026 · **Ngày demo:** 19/10/2026 (theo thông tin nhóm cung cấp)  
**Thành viên:** Thang · Kien · Tu · Bao  
**Căn cứ:** [Requirements và kiến trúc](../architecture/requirements.md), [kịch bản mock S0-S5](../demo/mock-data.md).\
**Trạng thái:** Phân công đề xuất để nhóm thống nhất; chưa xác nhận năng lực, thời gian hoặc cam kết nhận việc của từng thành viên.

## 1. Mục tiêu chung và cách chia việc

Hoàn thành một web demo trên nền bản đồ: khách chọn địa điểm, phương tiện và giờ xuất phát; hệ thống tính phương án tới đúng cửa. Người vận hành nhập thông báo, kiểm tra vị trí, duyệt thay đổi; A/B đổi lối phù hợp, C giữ tuyến trong cùng ngữ cảnh kiểm tra.

Giữ kiến trúc modular monolith: một ứng dụng Next.js/TypeScript, database chung, các module có trách nhiệm riêng. Dữ liệu mô phỏng đi qua cùng engine và luồng duyệt dự kiến dùng cho pilot. Bản đồ tương tác là hạng mục bắt buộc.

| Thành viên | Vai trò chính | Phần sở hữu | Đầu ra quan trọng nhất |
|---|---|---|---|
| **Thang** | Web khách, bản đồ và tích hợp sản phẩm | Giao diện khách, thành phần bản đồ dùng chung, cấu hình ứng dụng/deploy | Khách thao tác trên bản đồ và hiểu đúng phương án từng chặng |
| **Kien** | Engine và API tìm phương án | Graph, rules, time, Access Planning, adapter Directions | Tìm đường đúng phương thức/thời gian và trả lý do rõ |
| **Tu** | Dữ liệu, database và công bố phiên bản | Fixtures, Place Catalog, Evidence, Review and Publication | Dữ liệu có nguồn; duyệt/công bố nhất quán; preview tác động |
| **Bao** | AI và giao diện người vận hành | Notice Ingestion, AI adapter, admin UI | Thông báo thành nháp có thể sửa, duyệt vị trí và xem trước-sau |

Thang và Bao chia hai giao diện; Kien và Tu chia tính toán nghiệp vụ với lưu trữ/công bố. Tu xây dữ liệu và kiểm thử kịch bản thay cho nhiệm vụ khảo sát thực địa trong giai đoạn mock. Mỗi người tự kiểm tra phần mình; không dồn toàn bộ QA cho Tu.

## 2. Thang - Web khách, bản đồ và tích hợp

**Cập nhật 01/10/2026:** nhánh `Thang` đã triển khai giao diện khách, bản đồ dùng chung, hai chế độ fixture/API, phản ánh, đồng bộ phiên bản và bộ kiểm thử. Chi tiết, bằng chứng kiểm tra và phần còn chờ tích hợp: [Bàn giao Thang](../handoffs/thang.md). Chưa nghiệm thu end-to-end bằng engine/admin thật.

### Công việc bắt buộc

- [ ] Khởi tạo cấu trúc ứng dụng, quy ước giao diện, scripts chạy/build và `.env.example` chỉ có tên biến/giá trị mẫu.
- [ ] Tạo màn hình bản đồ responsive, có lớp địa điểm, cửa, đường nối, điểm gửi xe và vùng/rào thi công.
- [ ] Tạo thành phần bản đồ dùng chung cho Bao: nhận GeoJSON theo version, danh sách đối tượng được chọn và callback chọn đối tượng. Không nhúng logic duyệt vào component.
- [ ] Tìm/chọn địa điểm; chọn điểm xuất phát hợp lệ trong cụm; xe máy/đi bộ; giờ xuất phát.
- [ ] Gọi API AccessPlan, hiển thị từng chặng, phương thức, quãng đi bộ, cửa đích, nguồn và thời điểm kiểm tra.
- [ ] Hiển thị đúng `available`, `needs_verification`, `no_plan_found`; loading, lỗi mạng và kết quả rỗng.
- [ ] Hiển thị nhãn mô phỏng/đồng hồ demo; không gọi tuyến mock là tuyến xác minh thực địa.
- [ ] Đồng bộ layer và tuyến cùng version; loại bỏ response cũ đến muộn khi người dùng đổi truy vấn.
- [ ] Tải lại phương án khi version đổi hoặc tới mốc giờ điều kiện; phối hợp Kien xác định mốc cần tính lại.
- [ ] Làm form phản ánh đơn giản và link mở trực tiếp một địa điểm.
- [ ] Tích hợp các nhánh, chuẩn bị môi trường demo sau khi nhóm thống nhất cấu hình; tổ chức kịch bản pitch và video dự phòng.

**Phạm vi mã đề xuất:** `src/app/`, `src/features/access-explorer/`, `src/components/map/`, app shell và cấu hình build/deploy. Bản đồ nền dùng SDK/tài nguyên đã được cấp; quyền sử dụng cần được kiểm tra khi tích hợp.

**Đầu vào cần nhận:** Tu cung cấp layer/địa điểm mẫu; Kien cung cấp request/response AccessPlan; Bao cung cấp trạng thái luồng admin để tích hợp demo.

**Nghiệm thu:** trên màn hình rộng 360 px vẫn hoàn tất chọn A → xem chặng xe máy tới P → đi bộ qua G2. Sau cập nhật G2, giao diện dùng version mới và vẽ đúng tuyến G3; không giữ tuyến cũ dưới nhãn phiên bản mới. Có chữ giải thích trạng thái, không chỉ màu.

## 3. Kien - Engine và Access Planning

### Công việc bắt buộc

- [ ] Định nghĩa contract đầu vào/đầu ra của `planAccess(snapshot, request, context)`; làm hàm thuần, không gọi database/HTTP bên trong engine.
- [ ] Xây graph có hướng; trạng thái gồm vị trí, phương thức và điểm đã gửi xe khi cần.
- [ ] Kiểm tra phương tiện, chiều đi, điều kiện cửa/đoạn và chuyển phương thức tại P.
- [ ] Tính thời điểm đi qua từ giờ xuất phát và thời gian từng chặng/chuyển phương thức; dùng Clock được truyền vào cho demo.
- [ ] Sinh và đánh giá tuyến ứng viên; loại tuyến không hợp lệ trước khi xếp hạng. Công bố giới hạn tìm kiếm, không mặc định tìm tối ưu toàn mạng.
- [ ] Ưu tiên tổng thời gian, sau đó quãng đi bộ; dùng tie-break ổn định để kết quả có thể lặp lại.
- [ ] Trả `route_status`, `data_kind`, `data_version`, `legs`, nguồn, lý do và phạm vi tìm kiếm.
- [ ] Phân biệt thiếu căn cứ với chưa tìm thấy lối; loại bỏ nguồn cũ cho phép đi nhưng không tự làm hết hiệu lực lệnh cấm.
- [ ] Xây module Access Planning và endpoint `POST /api/v1/access-plans`; đọc snapshot qua repository interface do Tu triển khai.
- [ ] Cung cấp hàm so sánh kết quả trên cùng bộ truy vấn cho Tu dùng trong preview; không ghi database trong hàm so sánh.
- [ ] Viết kiểm thử nghiệp vụ S0-S5, ranh giới giờ, hướng và phương tiện. Dùng đáp án fixture được Tu kiểm tra độc lập.

**Phạm vi mã đề xuất:** `src/core/graph/`, `src/core/rules/`, `src/core/time/`, `src/modules/access-planning/`, `src/infrastructure/maps/` và route handler AccessPlan.

**Đầu vào cần nhận:** Tu cung cấp fixtures và snapshot schema; Thang thống nhất thông tin cần hiển thị trong từng chặng.

**Nghiệm thu:** tính ra chặng đi bộ tới A là 90 m ở S0, 200 m ở S1; B ở S1 là 215 m theo fixture. S2 không có lối; S3 phân biệt người gửi xe với người đi bộ qua P; S4/S5 xử lý nguồn đúng. Xuất phát trước 20:00 nhưng tới P sau 20:00 không được nhận xe nếu lịch nhận xe đã kết thúc.

**Làm sau khi lõi đạt nghiệm thu:** tích hợp Directions chặng ngoài; kiểm tra mã phương tiện, đầu cuối kết nối và hạn chế đã biết. Chưa có API key vẫn phát triển engine trên graph nội bộ; không tự bịa tuyến ngoài cụm.

## 4. Tu - Dữ liệu, database và phiên bản

### Công việc bắt buộc

- [ ] Chuẩn hóa fixture O/P/G1/G2/G3/J/A/B/C, edges, lịch hoạt động, bằng chứng và S0-S5 theo tài liệu mock.
- [ ] Tạo GeoJSON để hiển thị trên bản đồ; kiểm tra kết nối node-edge, hướng, tọa độ và cách biểu diễn chiều dài giả lập.
- [ ] Ghi đáp án kỳ vọng của từng scenario bằng cách đối chiếu bảng cạnh/quy tắc; không lấy output engine làm đáp án chuẩn.
- [ ] Thiết kế migration, seed và repository interfaces cho PostgreSQL/PostGIS; cùng Kien chốt `DatasetSnapshot`.
- [ ] Lưu Dataset/Version, Place, Evidence, ChangeSet, Report, audit và quyền người duyệt. Snapshot công bố bất biến; dữ liệu map và route đọc cùng version.
- [ ] Triển khai API tìm/chi tiết địa điểm, access layer, version và tiếp nhận phản ánh.
- [ ] Triển khai tạo/sửa ChangeSet, preview và publish. Preview gọi engine Kien trên bản cũ/mới, cùng điểm xuất phát, phương tiện và giờ.
- [ ] Kiểm tra lại trường dữ liệu và bằng chứng phía server trước publish; nội dung AI hoặc client không được tự đổi quy định live.
- [ ] Công bố trong transaction: khóa dataset, kiểm tra `base_version`, ghi snapshot/audit và đổi version hiện tại đồng thời.
- [ ] Xử lý publish lặp và conflict; cùng ChangeSet không tạo version trùng, bản nháp dựa trên version cũ phải được xem lại.
- [ ] Thực hiện kiểm tra quyền server cho API admin bằng cơ chế xác thực chung; client không được quyết định quyền.
- [ ] Tạo script reset/seed cho môi trường demo; không để endpoint reset công khai thiếu bảo vệ.
- [ ] Viết integration tests về version, nguồn, phân quyền và publish đồng thời.

**Phạm vi mã đề xuất:** `src/demo/`, `data/demo/`, `src/infrastructure/db/`, `src/modules/places/`, `src/modules/evidence/`, `src/modules/review-publication/`, middleware/helper quyền dùng chung và route handlers tương ứng.

**Đầu vào cần nhận:** Kien cung cấp engine và hàm diff; Bao cung cấp schema nháp và yêu cầu hiển thị preview; Thang cung cấp bbox/layer contract.

**Nghiệm thu:** nháp không thay đổi tuyến công bố; publish hợp lệ tăng version đúng một lần; A/B đổi, C giữ kết quả trong cùng ngữ cảnh. Hai người publish trên cùng version không ghi đè mất cập nhật. Bản ghi nguồn cũ và phản ánh “đã mở lại” không tự mở cạnh.

## 5. Bao - AI và web người vận hành

### Công việc bắt buộc

- [ ] Tạo trang admin theo app shell/map component chung; sử dụng cơ chế đăng nhập và quyền do Tu tích hợp.
- [ ] Cho nhập thông báo dạng văn bản và nhập tay các trường; upload PDF/OCR làm sau.
- [ ] Xây AI adapter phía server và endpoint extract; có timeout, thông báo lỗi và phương án nhập tay.
- [ ] Trích xuất vị trí/đối tượng ứng viên, phương tiện, hướng, hiệu lực và đoạn nguồn tương ứng. Thiếu dữ kiện thì để trống/yêu cầu xác minh.
- [ ] Validate output AI theo contract chung; ID không tồn tại không được gửi thẳng thành quy tắc đã duyệt.
- [ ] Hiển thị văn bản nguồn cạnh trường trích xuất; cho sửa và chọn cửa/đoạn trên bản đồ.
- [ ] Tạo/lưu bản nháp qua API của Tu; luôn giữ `base_version` và liên kết Evidence.
- [ ] Xây màn hình preview trước-sau, các địa điểm thay đổi, lý do và ngữ cảnh so sánh.
- [ ] Gọi publish, xử lý conflict và kết quả thành công; trong môi trường mock dùng nhãn “Duyệt vào demo”.
- [ ] Hiển thị phản ánh chờ kiểm tra và nguồn mâu thuẫn theo dữ liệu backend.
- [ ] Chuẩn bị tập thông báo đánh giá tách với ví dụ dùng chỉnh prompt; đo đúng trường, tỷ lệ sửa và thời gian thao tác có AI/nhập tay.
- [ ] Viết kiểm thử validator và luồng admin: output thiếu/sai, API lỗi, người dùng không có quyền, conflict khi duyệt.

**Phạm vi mã đề xuất:** `src/app/admin/`, `src/modules/notice-ingestion/`, `src/infrastructure/ai/`, endpoint extract. Tu sở hữu logic lưu/công bố; Bao gọi các API đó từ giao diện.

**Đầu vào cần nhận:** Thang cung cấp map component; Tu cung cấp Evidence/ChangeSet APIs; Kien cùng Tu xác nhận ý nghĩa các trường quy tắc.

**Nghiệm thu:** nhập thông báo G2 đóng từ 18:00, AI tạo nháp có đoạn nguồn; sửa được, chọn đúng G2 trên map, xem diff rồi duyệt. AI lỗi vẫn làm trọn luồng bằng nhập tay. Không có đường tắt từ phản hồi AI sang dữ liệu công bố.

## 6. Hợp đồng tích hợp và người chịu trách nhiệm

Chốt bảng này ở buổi làm việc đầu tiên. Mỗi contract có một người chủ trì và ít nhất một người sử dụng review; mọi người có thể phát triển bằng response mẫu đúng schema trong lúc chờ backend.

| Hợp đồng / API | Chủ trì | Người review / sử dụng |
|---|---|---|
| `DatasetSnapshot`, Evidence, Rules, TransferRule | Tu | Kien; Bao review trường cần nhập |
| `AccessPlanRequest/Response`, enums và reason codes | Kien | Thang, Tu |
| Map component: layer, selection, click callbacks | Thang | Bao |
| Schema kết quả AI và đoạn nguồn | Bao | Tu, Kien |
| Places, chi tiết, access-layer, dataset version | Tu | Thang |
| `POST /api/v1/access-plans` | Kien | Thang |
| `POST /api/v1/reports` | Tu | Thang, Bao |
| `POST /api/v1/admin/notices/extract` | Bao | Tu |
| Tạo/sửa/preview/publish ChangeSet | Tu | Bao; Kien review cách gọi engine |
| Script seed/reset demo, fixture đáp án | Tu | Kien |
| Cấu hình build, `.env.example`, môi trường demo | Thang | Cả nhóm rà biến cấu hình của module mình |

**Bổ sung hợp đồng còn thiếu trong tài liệu kiến trúc:** cần một cách tạo ChangeSet ban đầu. Đề xuất `POST /api/v1/admin/changesets`, do Tu triển khai; Bao gọi sau khi trích xuất hoặc nhập tay. Endpoint extract chỉ trả kết quả trích xuất, không tự publish. Tu và Bao chốt cách ghi Evidence/bản gốc cùng lúc tạo bản nháp trước khi code hai đầu.

Các trường bắt buộc cần thống nhất: dataset/version, `depart_at` có múi giờ, mode, purpose, origin, `route_status`, `data_kind`, IDs của bằng chứng, geometry từng chặng và mốc cần tính lại. Không tự đổi `arrival_time` thành `depart_at` ở riêng frontend.

### Tránh sửa chồng nhau

- Chủ trì cấu hình gốc, package scripts và lockfile: Thang. Người cần dependency mới nêu rõ trong PR và phối hợp thay đổi.
- Migration/schema DB: Tu chủ trì. Thay đổi kiểu dữ liệu phải được Kien/Bao/Thang liên quan review.
- `src/contracts/`: chia file theo nghiệp vụ; chủ trì theo bảng trên, không để bốn người sửa cùng một file tổng.
- `src/app/layout.tsx` và component bản đồ chung: Thang chủ trì; Bao sở hữu trang admin riêng.
- `.env.example` chứa tên biến và ví dụ vô hiệu; key thật cấu hình ngoài repository public.

## 7. Timeline từ 26/09 đến 19/10/2026

### 7.1. Nguyên tắc lập lịch

**Ngày 17/10 phải có bản bàn giao hoàn chỉnh**, gồm ứng dụng, dữ liệu, hướng dẫn chạy, pitch deck và video dự phòng. **Ngày 18/10 dành cho diễn tập và kiểm tra thiết bị; ngày 19/10 demo**, theo lịch người dùng cung cấp. Không tính ngày 18/10 là ngày phát triển chức năng.

Chốt chức năng chính vào **09/10**, để có tám ngày 10-17/10 cho kiểm thử tích hợp, sửa lỗi và đóng gói. Mục tiêu là hoàn thành luồng chính sớm, không dồn tích hợp vào ngày cuối.

Lịch đề xuất giả định mỗi người có thể dành khoảng 2-3 giờ tập trung/ngày thường và khoảng 4 giờ/ngày cuối tuần trong giai đoạn xây dựng; đây chưa phải thời lượng từng người đã cam kết. Nhóm xác nhận khả năng tham gia ở buổi đầu. Nếu thiếu thời gian, cắt hạng mục mở rộng trước và giữ các mốc tích hợp; không mặc định bù bằng làm xuyên đêm.

Quy định về phần việc được chuẩn bị trước cuộc thi vẫn cần BTC xác nhận. Nhóm chủ động hỏi ngay 26-27/09; nếu có giới hạn, điều chỉnh thời điểm viết mã theo hướng dẫn. Lịch này là kế hoạch nội bộ, không thay thế thể lệ.

### 7.2. Lịch theo giai đoạn và từng thành viên

| Thời gian | Mốc | Thang | Kien | Tu | Bao | Đầu ra phải có cuối giai đoạn |
|---|---|---|---|---|---|---|
| **26-27/09** (T7-CN) | **M0: chốt nền tảng** | App shell, layout khách, contract map; tổng hợp câu hỏi BTC và kiểm tra tài nguyên bản đồ | Chốt engine request/response, trạng thái phương thức, quy tắc thời gian | Chốt snapshot/schema; seed S0, IDs và đáp án kỳ vọng | Wireframe admin, schema AI draft, form nhập tay mẫu | Contract chung và fixture S0; xác định ai bàn giao gì; kế hoạch API key/quyền sử dụng |
| **28/09-01/10** (T2-T5) | **M1: khách tìm được lối** | Map thật tương tác + layer mô phỏng; chọn A/phương tiện/giờ, vẽ chặng | Engine S0, AccessPlan API, kiểm tra đổi phương thức tại P | DB/migration/seed; places, access-layer và version APIs | Form nhập tay, chọn cửa trên map; tích hợp tạo/sửa ChangeSet với Tu | Demo trên môi trường chung: O→P→G2→J→A, chặng đi bộ 90 m; dữ liệu và tuyến cùng version |
| **02-05/10** (T6-T2) | **M2: thay đổi làm đổi tuyến** | Refetch theo version; hiển thị trước-sau và lý do | Rule G2, hàm tính lại/diff; thêm S2-S3 | Preview/publish, audit, base_version; cấu hình quyền admin | Trang preview và duyệt; nối form nhập tay vào luồng đầy đủ; thử extractor trên mẫu | Nhập tay thông báo G2 đóng → duyệt → A/B qua G3, C giữ tuyến; có thể reset và lặp lại |
| **06-09/10** (T3-T6) | **M3: đủ chức năng cốt lõi** | Trạng thái thiếu/lỗi, phản ánh, link địa điểm; mốc giờ tính lại | Hoàn thành S0-S5, ranh giới giờ/hướng, giới hạn tìm kiếm | Nguồn cũ/xung đột; publish lặp/đồng thời; quyền, seed/reset | AI extract có validator và đoạn nguồn; sửa nháp; nhập tay khi AI lỗi | Cả hai luồng chạy đủ; kiểm thử nghiệp vụ chính đạt; chốt chức năng tối 09/10 |
| **10-12/10** (T7-T2) | **Kiểm thử tích hợp và UX** | Điều phối thử giao diện từ xa; kiểm tra điện thoại; draft pitch | Review dữ liệu độc lập cùng Tu; sửa lỗi tuyến/giờ và đo phản hồi | Kiểm tra từ DB sạch, version, quyền, reset; tổng hợp lỗi và bằng chứng | Đánh giá AI trên mẫu tách biệt; thử UX admin, sửa lỗi và ghi giới hạn | Danh sách lỗi có chủ sở hữu; kết quả test thật; chọn kịch bản demo và thông điệp pitch |
| **13-15/10** (T3-T5) | **M4: bản ứng viên bàn giao** | Hoàn thiện UI cần thiết, pitch, link demo và README | Sửa lỗi còn lại, chốt kiểm tra hồi quy sau sửa | Kiểm tra seed/migration và bản sao dữ liệu demo; rà nguồn/nhãn mock | Hoàn thiện hướng dẫn admin, số đo AI, phối hợp quay video dự phòng | Đến tối 15/10: bản ứng viên chạy ổn định, deck/video/hướng dẫn đủ để diễn tập |
| **16/10** (T6) | **Diễn tập như buổi thật** | Trình bày trọn demo và deck, kiểm tra thời lượng | Theo dõi engine và trả lời câu hỏi thuật toán | Vận hành reset/dữ liệu, kiểm tra tình huống thiếu mạng | Thao tác admin/AI và kiểm tra phương án nhập tay | Chạy ít nhất 2 lượt từ reset trên máy trình bày; ghi và sửa các lỗi chặn demo |
| **17/10** (T7) | **Chốt bản cuối** | Kiểm tra URL, deck/video, bàn giao và ghi bản phát hành | Xác nhận bộ test cốt lõi trên đúng bản cuối | Xác nhận dữ liệu, tài khoản demo và cách khôi phục | Xác nhận luồng admin, AI và phương án dự phòng | Hoàn tất checklist mục 7.5 trước 20:00 (giờ Việt Nam); khóa thay đổi tính năng |
| **18/10** (CN) | **Dự phòng và diễn tập nhẹ** | Kiểm tra máy, trình chiếu, link và tập nói | Rà phần trả lời kỹ thuật | Kiểm tra truy cập/reset, chuẩn bị dữ liệu demo | Rà thao tác admin và video dự phòng | Không thêm chức năng; chỉ xử lý sự cố chặn demo nếu phát sinh |
| **19/10** (T2) | **Demo** | Trình bày chính, điều phối | Hỗ trợ kỹ thuật và Q&A | Theo dõi dữ liệu/môi trường | Thao tác hoặc hỗ trợ admin/AI | Demo đúng bản đã chốt; người trình bày dự phòng được thống nhất trước |

### 7.3. Những lần kiểm tra tiến độ không được bỏ

- **27/09:** kiểm tra schema, enum, ID và response mẫu đã thống nhất; xác định thời gian thực tế của mỗi người. Không chờ đủ API để bắt đầu xây fixture/engine.
- **01/10:** mở môi trường chung và tự chọn A để nhận tuyến. API trả JSON hoặc ảnh giao diện riêng lẻ chưa đủ nghiệm thu M1.
- **05/10:** chạy liên tục luồng nhập tay → preview → publish → bản đồ đổi tuyến. Đây là mốc phát hiện sớm vấn đề tích hợp.
- **09/10:** chốt tính năng; lập danh sách phần chưa đạt. Mục bắt buộc chưa đạt được xử lý như lỗi chặn hoàn thành, không đánh dấu đã xong.
- **12/10:** chốt kịch bản demo, lỗi ưu tiên và số liệu có thể trình bày. Không đưa mục tiêu dự kiến lên slide như kết quả thực đo.
- **15/10:** mọi tài liệu và video có bản đủ dùng; không bắt đầu viết pitch vào 17/10.
- **17/10:** chốt bản cuối trước 20:00. Không để công việc bắt buộc được chuyển sang 18/10 mà vẫn báo dự án đã hoàn thành.

Mỗi checkpoint dành khoảng 20-30 phút cho chạy demo và ghi quyết định. Cập nhật ngắn cuối mỗi ngày làm việc; đầu việc chặn người khác quá một ngày cần được nêu ngay, không chờ đến checkpoint.

### 7.4. Cách xử lý nếu chậm tiến độ

**Thứ tự bỏ hoặc hoãn:** Directions chặng ngoài → upload PDF/OCR → dashboard nâng cao → trình biên tập graph đầy đủ → hiệu ứng và tùy biến giao diện. Giữ map tương tác, graph có điều kiện, luồng duyệt, phiên bản và nhãn dữ liệu.

| Dấu hiệu | Quyết định xử lý |
|---|---|
| Đến 27/09 chưa có key/SDK | Thang theo dõi với BTC; Kien/Tu tiếp tục engine/fixture, Bao tiếp tục nhập tay. Tìm phương án nền bản đồ được phép sử dụng để vẫn đạt M1; không dùng ảnh tĩnh thay cho map tương tác. |
| Đến 01/10 chưa chạy được S0 xuyên suốt | Trong buổi kế tiếp, cả nhóm ưu tiên M1. Chốt 3 cửa hàng và điểm xuất phát cố định hợp lệ trong cụm; dừng phần mở rộng. Thang-Kien xử lý UI/API, Tu hỗ trợ dữ liệu, Bao giữ form tối thiểu. |
| Đến 05/10 publish còn lỗi | Tu-Kien ưu tiên version/engine; Bao giảm trang admin về nhập, preview, duyệt; Thang hỗ trợ kiểm thử tích hợp. Chưa đầu tư thêm prompt hoặc giao diện nâng cao. |
| Đến 09/10 AI chưa ổn | Bao thu hẹp đầu vào về văn bản và một schema; giữ nhập tay dự phòng. Tách rõ kết quả AI còn lỗi, không dùng phản hồi gán sẵn như đang trích xuất trực tiếp. |
| 10-15/10 xuất hiện lỗi tuyến hoặc mất nhất quán | Sửa trước lỗi giao diện thẩm mỹ; người phụ trách module và reviewer cùng tái hiện bằng fixture. Chỉ chạy lại các kiểm tra liên quan và luồng demo sau khi sửa. |
| Ngày 16-17/10 còn lỗi chặn demo | Tập trung cả nhóm vào bản ổn định cuối; loại tính năng tùy chọn gây lỗi. Nếu phần cốt lõi vẫn lỗi, ghi rõ chưa đạt và chuyển cách trình diễn sang bằng chứng đã kiểm tra, không tuyên bố bản hoàn chỉnh. |

Ngày 13-15/10 là khoảng đệm sửa lỗi có chủ đích, không tự động biến thành thời gian thêm tính năng. Ngày 18/10 là dự phòng sự cố; mọi hotfix phải có người review, chạy lại tình huống liên quan và giữ bản trước để khôi phục.

### 7.5. Checklist phải xong ngày 17/10

- [ ] Web demo truy cập được; tài khoản người vận hành đã thử trên máy trình bày.
- [ ] Map tương tác, layer và tuyến dùng cùng version; có nhãn mô phỏng rõ ràng.
- [ ] Luồng khách → nhập thông báo → sửa/duyệt → tính lại A/B/C chạy đủ.
- [ ] S0-S5 và các kiểm tra bắt buộc ở mục 8 đạt trên đúng bản bàn giao.
- [ ] Không còn lỗi chặn demo: không tải được map, tuyến vi phạm rule, publish sai version, truy cập trái quyền hoặc không reset được.
- [ ] Đã thử lỗi AI/mạng; biết khi nào dùng nhập tay, dữ liệu demo và video dự phòng, có nhãn phù hợp.
- [ ] Seed/reset, migration, biến môi trường và hướng dẫn chạy đã được một người khác làm lại thành công.
- [ ] Pitch deck, video và tài liệu bàn giao thống nhất với tính năng thật và dữ liệu đã dùng.
- [ ] Đã diễn tập ít nhất hai lượt; có người trình bày/thao tác thay thế. Demo 4 phút là kịch bản nội bộ, điều chỉnh theo thời lượng BTC xác nhận.
- [ ] Bản mã nguồn cuối và dữ liệu demo được lưu; ghi commit hoặc tag phát hành để xác định đúng phiên bản.
- [ ] Nhóm rà hạn nộp/link/tệp của BTC; nếu hạn chính thức sớm hơn, dời mốc đóng gói lên tương ứng.

**Định nghĩa “xong ngày 17/10”:** có thể mang đúng bản bàn giao đi demo ngay, không cần hoàn thành thêm một chức năng bắt buộc nào trong ngày 18/10.

## 8. Checklist kiểm chứng chung

| Kịch bản | Kỳ vọng | Chủ trì kiểm thử | Review chéo |
|---|---|---|---|
| S0 | A qua G2; đi bộ 90 m; chỉ gửi xe ở P | Kien | Tu đối chiếu dữ liệu; Thang xem UI |
| S1 | A qua G3: 200 m; B: 215 m; C giữ tuyến | Tu | Kien, Bao, Thang kiểm tra hai giao diện |
| S2 | Các lối hợp lệ đóng: không tạo tuyến xuyên rào | Kien | Thang |
| S3 | P hết giờ nhận xe; người đi bộ vẫn đi qua nếu đường không đóng | Kien | Tu |
| S4 | G2 cần kiểm tra lại; dùng G3 đủ căn cứ hoặc báo thiếu thông tin | Tu | Kien |
| S5 | Phản ánh mở lại tạo hồ sơ kiểm tra, không tự mở G2 | Tu | Bao |
| Biên thời gian | Giờ tới P/cửa quyết định hợp lệ; version không đổi vẫn tính lại theo giờ | Kien | Thang |
| Mở lối mới | Phát hiện phương án mới dù tuyến cũ không qua cạnh đó | Kien | Tu |
| Publish | Nháp không ảnh hưởng live; xử lý lặp/conflict và quyền | Tu | Bao |
| AI | Thiếu ngày kết thúc, sai ID, ngoại lệ phương tiện; sửa được | Bao | Tu |
| UX và dữ liệu | Map/route cùng version; nhãn mô phỏng; lỗi mạng và màn hình nhỏ | Thang | Bao |

Kết quả kiểm thử mock chỉ được báo là kiểm chứng kịch bản phần mềm. Phỏng vấn hoặc thử giao diện từ xa do Thang điều phối, mỗi thành viên hỗ trợ một phần; kết quả thực địa chỉ bổ sung khi thực sự có điều kiện thu thập.

## 9. Cách bàn giao trong nhóm

Mỗi đầu việc có: người phụ trách, dependency, đầu ra và cách nghiệm thu. Dùng nhánh theo module, ví dụ `feat/customer-map`, `feat/access-engine`, `feat/data-publication`, `feat/admin-ai`.

PR nên có mô tả hành vi trước/sau, dữ liệu dùng thử, cách chạy và kiểm tra đã thực hiện. Người sử dụng đầu ra review PR tích hợp; Thang điều phối merge, không phải người duy nhất chịu trách nhiệm kiểm tra mọi module.

Cuối mỗi buổi, mỗi người cập nhật ba dòng: **đã xong gì; đang bị chặn bởi gì; cần ai bàn giao gì tiếp theo**. Nếu schema/API thay đổi, cập nhật contract và ví dụ trước khi yêu cầu các phần khác sửa theo.

**Luồng ưu tiên của cả đội:** map và dữ liệu → tìm lối → duyệt thay đổi → tính lại đúng → AI hỗ trợ → hoàn thiện demo.
