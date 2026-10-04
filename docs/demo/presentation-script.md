# AccessLink — Kịch bản demo giao diện khách (bản 01/10)

## Mở đầu (~25 giây)

“Địa điểm vẫn mở cửa, nhưng lối mặt tiền bị chắn. Người dùng cần biết gửi xe ở đâu và đi bộ qua cửa nào. AccessLink biểu diễn mạng lối tiếp cận, điều kiện giờ và bằng chứng trên bản đồ. Đây là dữ liệu mô phỏng; phần trình diễn hôm nay là giao diện dùng đáp án mẫu, engine tích hợp đang do thành viên khác phát triển.”

## Thao tác (~90 giây)

1. S0, chọn A, xe máy: chỉ bản đồ O→P và chặng đi bộ P→G2→J→A dài 90m. Điểm gửi xe và phương thức chuyển chặng xuất hiện rõ.
2. S1: G2 đóng sau18:00, A qua G3 dài200m. Chọn B=215m, C không cần đi bộ. Nêu đây là hai trạng thái mẫu, chưa phải thao tác publish thật từ admin.
3. S2: A không có phương án trong cụm. Không vẽ tuyến xuyên rào.
4. S3, A: xe máy không còn chỗ gửi theo fixture; đổi đi bộ cho kết quả190m, không biến “hết giờ nhận xe” thành “cấm đi bộ”.
5. S4: G2 cần kiểm tra lại; xem bản ghi nguồn và ngày kiểm tra. S5/phản ánh: dữ liệu cộng đồng chưa duyệt không tự mở cổng.

## Kết thúc (~25 giây)

“Bản đồ thiết yếu vì kết quả phụ thuộc cửa, cạnh đường nối và khả năng chuyển phương tiện. Bước tiếp theo là nối engine và luồng công bố thật để kiểm chứng đổi version, rồi thử nghiệm bằng dữ liệu thực địa. Những quãng đường vừa xem là số liệu fixture, chưa phải bằng chứng tiết kiệm thời gian thực tế.”

## Video dự phòng

Chạy `npm run dev`, sau đó `npm run demo:record`. File `artifacts/videos/AccessLink_Thang_UI_Fixture_Demo.webm` ghi thao tác thực trên giao diện, không có thuyết minh. Tên và nhãn màn hình luôn chỉ rõ dùng fixture. Quay lại video tích hợp cuối khi engine/admin đã ghép xong; không dùng video này để tuyên bố có routing hoặc publish thật.
