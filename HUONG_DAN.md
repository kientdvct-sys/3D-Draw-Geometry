# TEST2 — hệ thống điểm và dựng hình

Bản mới dùng thanh công cụ dọc ở mép trái; bảng thuộc tính mặc định đóng, Camera thu gọn ở góc dưới. Vùng giữa dành cho hình 3D, còn hình 2D nằm trong cột bên phải trên desktop. Mặt khối được tô nhẹ và các nét/điểm khuất giảm độ đậm để phân biệt chiều sâu.

Mở PowerShell tại `D:\TESTSTUDYPROJECT` và chạy:

```powershell
node server.mjs
```

Mở [http://127.0.0.1:3000/TEST2.html](http://127.0.0.1:3000/TEST2.html). Máy cần Node.js 20 trở lên. Chế độ mặc định không cần cài thêm thư viện.

Mở ứng dụng qua localhost để trình duyệt tải các module JavaScript, dùng camera và kết nối API. Nút **Xuất JSON** tải snapshot 8.0 với ID điểm độc lập với tên hiển thị. Studio vẫn nhập được snapshot 7.0 và duy trì định dạng tương thích cho bản nháp, lưu nhanh và Undo.

## Chuột và cảm ứng, khi Camera AI đang tắt

- **1 · Chọn.** Bấm chấm hoặc nhãn để chọn điểm. Khi cần nối nhanh, có thể kéo trái giữa hai điểm. Khi nhiều điểm chồng hình, chọn tên từ danh sách. Tab và Shift+Tab chuyển giữa các tên, Enter xác nhận. Điểm đang chọn có nút **Nối từ đây** và **Đổi tên**.
- **Bắt điểm.** Hệ thống ưu tiên tâm điểm và hỗ trợ khi thả hơi lệch khỏi điểm cuối vừa bắt. Thả vào vùng trống hủy nét nối nhanh. Trong công cụ Nối đoạn, điểm đầu được giữ để thử lại. Cả hai trường hợp đều không thêm bước Undo.
- **2 · Nối đoạn** là công cụ mặc định. Chọn **Đoạn**, **Tia** hoặc **Đường thẳng** trong mục **Vẽ**. Bấm điểm đầu và thả chuột, rồi di chuột để xem nét đứt và chấm mờ đi theo con trỏ. Bấm điểm thứ hai để vẽ. Tia đi từ điểm đầu qua điểm thứ hai, đường thẳng kéo dài về hai phía. Bật **Nối liên tiếp** nếu muốn tiếp tục từ điểm cuối, hoặc dùng **Esc** để hủy.
- **3 · Điểm:** bấm một cạnh/đoạn để tạo điểm gắn với đoạn đó; bấm vùng trống để tạo điểm tự do trên mặt phẳng nhìn hiện tại. Tên mới được tự chọn để không trùng.
- **4 · Trung điểm:** bấm một cạnh, hoặc chọn hai điểm bất kỳ. Nếu đã có trung điểm, công cụ chọn lại điểm đó.
- **5 · Xóa:** bấm điểm hoặc phần giữa đoạn để bỏ. Cũng có thể chọn bằng công cụ 1 rồi nhấn **Delete / Backspace**, hoặc dùng nút xóa trong danh sách.
- **6 · Nét:** bấm phần giữa đoạn để chuyển Tự động → Liền → Đứt. Hoặc chọn đoạn rồi bấm trực tiếp mẫu **Auto / nét liền / nét đứt** trên thanh nhỏ phía dưới; đổi nét có thể Undo.
- **7 · Di chuyển.** Giữ trái trên điểm rồi kéo. Có thể giữ **Alt** và kéo trái để di chuyển ngay từ công cụ Chọn. Điểm trên đoạn trượt theo đoạn gốc, điểm tự do theo mặt phẳng kéo đang chọn.
- **Bắt dính (S):** khi kéo điểm trên đoạn, hút nhẹ về ¼, ½ và ¾; điểm tự do dùng bước 0.1 trong mặt phẳng đang kéo. Tắt Bắt dính để kéo liên tục.
- **Mũi tên:** chỉnh điểm đang chọn. Với điểm trên đoạn, mỗi lần là 0.01 theo k, Shift là 0.05. Với điểm tự do, mũi tên dịch một pixel theo mặt phẳng kéo, Shift là 10 pixel. Ctrl+Z hoàn tác; Ctrl+Y hoặc Ctrl+Shift+Z làm lại.
- **Trình chiếu (F):** ẩn bảng thuộc tính và bớt phần hướng dẫn; vẫn giữ thanh công cụ dọc và hình 2D. Esc trở lại soạn hình. Đây là chế độ bố trí giao diện, không tự bật toàn màn hình hệ điều hành.
- **Bỏ chọn / Esc / Ctrl+D:** thả điểm đang giữ, bỏ chọn và kết thúc chuỗi nối. Với Esc, lần kéo chưa thả được hủy trước khi bỏ chọn. Chụm vào vùng trống trong công cụ Nối đoạn cũng kết thúc chuỗi.
- Điểm gắn đoạn chỉ trượt trên đoạn gốc. Khi kéo ra khỏi vị trí giữa, nó trở thành điểm chia đoạn; nút **½** đặt lại trung điểm chính xác. Thanh **k** cho phép chỉnh từ 0.01 tới 0.99.
- Các công cụ có hướng dẫn riêng ngay trên thanh công cụ. Khi đổi công cụ, lần kéo hiện tại kết thúc và lần chụm đang giữ được hủy.
- **Khóa đáy** mặc định bật. Giữ **chuột phải** và kéo ngang để xoay quanh trục vuông góc mặt đáy, giữ nguyên độ nghiêng. Tắt **Khóa đáy** nếu muốn xoay tự do theo mọi hướng bằng chuột phải. Lăn chuột để thu phóng.
- Bấm **↑ Đứng thẳng** hoặc nhấn **U** để đưa trục đứng về thẳng và giữ độ phóng hiện tại.
- Khi nhìn gần thẳng từ trên hoặc dưới, **Đứng thẳng** đưa góc nhìn về độ nghiêng dễ đọc. Khi đã mở khóa đáy, giữ **Alt** và kéo chuột phải theo chiều ngang để chỉnh độ nghiêng quanh tâm hình. **Góc SGK** hoặc phím **0** lấy lại góc chuẩn, khóa đáy và mức phóng mặc định. **Khung dây** ẩn màu các mặt khối, giữ nét khuất dạng nét đứt.
- **8 · Thiết diện.** Mở **Thêm → Thiết diện** rồi bấm ba điểm không thẳng hàng trên hình. Ứng dụng tạo mặt phẳng và tính giao với khối trong một bước Undo.
- Nối nhanh bằng nét **Auto** trên một cạnh có sẵn sẽ chọn cạnh đó. Có thể dùng **Nối đoạn** để dựng riêng một đoạn con, hoặc đổi kiểu nét khi cần nhấn mạnh.
- **L** bật hoặc tắt khóa đáy. **Space** nghỉ hoặc tiếp tục cử chỉ. **Esc** hủy thao tác đang làm. **Ctrl+Z / Ctrl+Y** hoàn tác hoặc làm lại nét dựng.
- Trên cảm ứng, dùng công cụ 2 để nối và công cụ 7 để di chuyển điểm. Kéo khoảng trống để xoay, dùng hai ngón để thu phóng.
- **Thiết Diện Mẫu** dựng đa giác mẫu; vùng tô chỉ xuất hiện khi các đoạn khép kín và đồng phẳng. Diện tích dùng tọa độ 3D.

## Nét liền / nét đứt tự động khi xoay

Chọn một cạnh hoặc đoạn để mở công cụ **Đoạn / Tia / Đường**. Dùng **Kéo dài** để dựng đường chứa đoạn, hoặc bấm tay nắm tròn rồi di chuột để xem tia hay đường thẳng trước khi bấm xác nhận. Kéo dài cạnh khối tạo một đường dựng phụ. Với đoạn dựng, lệnh chuyển loại có thể Undo.

Trên đường vừa chọn, nhập **t** rồi bấm **Đặt điểm**, hoặc dùng công cụ **Điểm** và bấm vào đường. Với thứ tự A → B, t = 0 ở A, t = 1 ở B, t = 1.5 vượt B và t = −0.5 nằm về phía ngược lại. Tia không nhận t âm. Đoạn chỉ nhận t từ 0 đến 1.

Chọn đường thứ nhất rồi chọn một đường hoặc mặt phẳng trong danh sách lấy giao. Nút **Tạo giao điểm** xuất hiện khi có một giao điểm. Nếu giao của đường chứa nằm ngoài miền hiện tại, dùng **Kéo dài đến giao điểm**. Giao điểm phụ thuộc cập nhật khi sửa đối tượng cha. Nếu giao mất, điểm còn trong danh sách Đối tượng cùng lý do. **Vừa khung** giúp đưa các điểm đã dựng vào vùng nhìn.

Mặc định các cạnh và đoạn dựng mới dùng **Tự động**. Bộ HiddenLineSolver kiểm tra tia nhìn có bị mặt của khối che hay không, tính lại theo góc xoay hiện tại; không quyết định nét dựa vào tên điểm cha. Điểm tự do và điểm phụ thuộc nhiều cấp dùng chung quy tắc.

- Phần nhìn thấy dùng nét liền; phần bị khối che dùng nét đứt. Một đoạn đi qua vùng che khuất có thể được vẽ thành nhiều phần liền/đứt.
- Khi đã chọn điểm đầu, đưa con trỏ tới điểm cuối để xem trước **đúng phần liền/đứt** theo góc nhìn hiện tại. Mẫu nét nhỏ dưới hình áp dụng ngay cho đường xem trước và đoạn sắp tạo. Bản 2D cũng xem trước theo góc chiếu riêng; nét đang thử chưa được lưu vào giáo án hay xuất SVG/PNG.
- Đường chéo trên mặt nhìn thấy vẫn có thể là nét liền. Đoạn nằm bên trong khối thường là nét đứt; không phải mọi đoạn nối thêm đều là nét đứt.
- Hình 3D, hình 2D và ảnh xuất dùng chung thuật toán che khuất. Hình 2D dùng phép chiếu song song; 3D dùng phối cảnh, nên ranh giới che khuất có thể khác một chút.
- Nếu đã ép nét bằng công cụ **Nét**, bấm **↻ Nét tự động** để đưa toàn bộ cạnh và đoạn trở về tự đổi nét. Nút này cũng bỏ quy tắc cố định của chế độ Video cũ. Giáo án nhập lại được đưa về chế độ tự động, vẫn giữ các kiểu nét riêng đã chọn.

## Bố cục và chiều sâu

- Bấm **Bảng** ở góc trái để mở kho hình/các bảng soạn. Chọn điểm sẽ hiện thanh nhỏ ở mép dưới; bấm **Thuộc tính** hoặc nhấp đúp điểm để mở bảng chỉnh. Tỉ lệ k, tọa độ, khóa/đổi tên nằm trong bảng này, không che phần giữa hình nữa.
- Bấm **⚙** cạnh nút Camera để mở bốn mục **Nguồn**, **Cử chỉ**, **Nền** và **Góc nhìn**. Bấm ra ngoài để đóng. Bật hoặc tắt luồng video bằng nút Camera ở góc dưới trái.
- Các mặt hướng về người xem được tô xanh xám bán trong suốt, có độ sáng khác nhau. Nét phía trước đậm hơn; nét khuất mảnh và nhạt. Điểm bị khối che dùng chấm rỗng/nhạt, nhưng vẫn chọn và nối được; khi chọn, điểm được nhấn rõ lại.
- Nhãn dùng chữ toán học gọn, có viền tương phản trên nền Camera; hệ thống tránh đặt nhãn lên thanh công cụ và các bảng. Chỉ mục thiết diện/diện tích nằm ở mép dưới, không đặt chồng giữa đa giác.
- Các dấu hiệu chiều sâu là cách hiển thị, không thay tọa độ hay quan hệ dựng hình. Nét tự động và phép chiếu 2D vẫn dùng cùng dữ liệu 3D.

## Danh sách điểm và đường

Bấm **Thuộc tính** trên thanh chọn điểm ở mép dưới hoặc mở **Bảng → Điểm/Nét**. Tìm theo tên rồi chọn trực tiếp: cách này xử lý được cả các điểm che khuất/chồng hình trong góc nhìn hiện tại. Khi danh sách ứng viên mở, dùng Tab để chuyển giữa các tên và Enter để chọn.

- Mỗi điểm có nút **Ẩn/Hiện** và **×**. Ẩn chỉ bỏ chấm/nhãn; tọa độ và các phép dựng phụ thuộc vẫn tồn tại.
- Xóa điểm dựng sẽ xóa cả những điểm dựng dựa vào nó và các đoạn liên quan. **Undo** khôi phục toàn bộ quan hệ này trong một bước.
- Đỉnh cấu thành khối như S/A/B/C/D được ẩn khi bấm xóa, giữ nguyên mặt/cạnh của khối; có thể hiện lại từ danh sách.
- Các đoạn dựng có thể chọn hoặc xóa riêng. Cạnh khối/đường phụ có nút Ẩn/Hiện riêng; Undo cũng khôi phục được cạnh đã bỏ.
- Mở **Tọa độ điểm đang chọn** để sửa x/y/z của điểm tự do. Với điểm gắn đoạn, dùng k hoặc **Tách thành điểm tự do** trước khi sửa tọa độ.
- **Đổi tên** bằng F2, nút bút ở Đối tượng hoặc nhấp đúp nhãn. Enter lưu, Esc hủy. Tên có thể dùng dấu nháy như A′ hoặc chỉ số như A_1. Một lần Undo khôi phục tên cũ. Nội dung đề bài nhập tay được giữ nguyên.
- **Khóa:** chặn kéo, sửa k/tọa độ, tách và xóa trực tiếp. Nếu xóa điểm cha sẽ làm mất một điểm con đang khóa, lệnh xóa cũng bị chặn và chỉ rõ tên điểm cần mở khóa. Điểm phụ thuộc đang khóa vẫn được tính lại khi điểm cha thay đổi; khóa bảo vệ thao tác trực tiếp.
- **Mặt phẳng kéo:** Theo góc nhìn giữ độ sâu hiện tại; XY giữ z, XZ giữ y, YZ giữ x. Nếu mặt phẳng gần song song tia nhìn, hãy xoay góc hoặc chọn Theo góc nhìn trước khi kéo. Bắt dính 0.1 được tính trong mặt phẳng đang chọn.
- Khi thay điểm gốc, đồ thị phụ thuộc tính lại các điểm con, kể cả nhiều cấp. Bản lưu giữ đúng các quan hệ, điểm đã xóa và trạng thái ẩn/hiện.

Vị trí điểm tự do được tính từ lúc bắt đầu kéo, tránh cộng dồn sai số khi chuột gửi nhiều sự kiện trước lần vẽ tiếp theo. Mất quyền bắt con trỏ, thay kích thước cửa sổ hoặc Esc sẽ hủy lần kéo chưa kết thúc. Nhãn được bố trí tránh chấm và các nhãn khác; vị trí nhãn không dịch theo vòng sáng khi rê chuột.

## Camera và cử chỉ

Bấm **Bật tay** ở cạnh nút Camera để điều khiển bằng cử chỉ. Trang sẽ xin quyền Camera nếu cần và cho dùng chuột trong lúc tải MediaPipe hoặc chờ nhận ra bàn tay. Khi thấy **Tắt tay**, bạn có thể bắt đầu dùng cử chỉ. Khi mất tín hiệu kéo dài, chuột dùng lại được và nhận diện tự tiếp tục khi thấy tay rõ. Chọn thiết bị ở **⚙ → Nguồn**. Nút **Bật Camera** chỉ mở video. Cần Internet để tải MediaPipe. Webcam được xử lý trong trình duyệt, API giáo án không nhận video.

Trong **Nền**, chọn hình Camera, Camera nền nhạt, Studio có lưới hoặc Studio trắng. Studio cho phép ẩn hình Camera trong khi tiếp tục nhận diện tay. Với nguồn điện thoại dọc, chọn **Giữ trọn khung hình** để thấy đủ khung video hoặc **Phủ màn hình** để lấp đầy vùng hiển thị. Có thể bật hoặc tắt lật gương ngang. **Góc nhìn** chứa khóa mặt sàn, góc SGK và các góc nhìn nhanh.

- **Chọn bằng một ngón trỏ:** duỗi ngón trỏ, các ngón còn lại gập thoải mái, đưa tới chấm hoặc nhãn. Giữ ổn định khoảng **0.82 giây** (120 ms chuẩn bị + 700 ms tiến trình). Vòng xanh chạy đủ sẽ chọn một lần; giữ tiếp không bấm lặp. Rời mục tiêu để chọn lại. Lướt ngang qua điểm hoặc đưa cả bàn tay mở lên không tự chọn.
- **Bấm bằng ngón trỏ:** sau khi chỉ đúng mục tiêu một nhịp, gập nhẹ khớp giữa ngón trỏ rồi duỗi lại nhanh trong khoảng 350 ms. Không cần chạm ngón cái. Phải có bước chỉ trước; một tay đã gập sẵn không được coi là bấm. Đây là nhận dạng chuyển động từ webcam, không phải cảm biến chạm vật lý.
- **Nối bằng ngón trỏ:** trong công cụ Nối đoạn, giữ hoặc bấm ngón trỏ tại điểm đầu, sau đó chuyển sang điểm cuối và chọn tiếp. Mỗi mục tiêu chỉ kích hoạt một lần; Esc/Bỏ chọn kết thúc chuỗi. Thao tác chuột vẫn như trước.
- **Kéo bằng ngón trỏ:** chọn **7 · Di chuyển**, giữ trỏ trên điểm cho vòng tiến trình chạy đủ rồi di chuyển ngón trỏ. **Gập ngón trỏ, mở cả tay hoặc rời Camera** để thả ngay. Điểm trên cạnh vẫn trượt trên cạnh; một Undo hoàn tác cả lần kéo. Có thể dùng chụm kéo như cách cũ.
- **Thêm/xóa và chọn nút bằng ngón trỏ:** chọn công cụ tương ứng rồi giữ trên mục tiêu. Xóa chờ lâu hơn, khoảng 1.22 giây. Trong Thêm điểm, giữ tại phần giữa cạnh tạo điểm gắn cạnh; giữ vùng trống tạo điểm tự do. Các nút công cụ, mẫu nét và Bỏ chọn cũng nhận giữ ngón trỏ.
- **Dấu lòng bàn tay:** khi bật Khung tay, có mốc ở cổ tay và bốn chân ngón, hai đường đo chéo lòng bàn tay, tâm lòng bàn tay và năm thanh độ duỗi ngón. Nhãn ghi **Mở …% · Nghiêng …°**. Đây là chỉ số hình học từ các khớp, không phải xác suất mô hình. Khớp chưa rõ/tay quá nhỏ hoặc nghiêng sát cạnh sẽ hạn chế xoay/zoom.
- **Chọn công cụ bằng tay:** đưa ngón trỏ vào nút trên thanh công cụ; viền xanh xuất hiện, chụm rồi thả để chọn nút. Dùng được với các công cụ, mẫu nét Auto/liền/đứt, Bỏ chọn, Nét tự động và Undo/Redo khi các nút đang hiển thị. Chụm trên nút không sửa hình ở phía sau giao diện.
- **Chụm nhẹ cái và trỏ:** thực hiện công cụ đang chọn. Với Nối đoạn: chụm chọn điểm đầu, thả, chuyển sang điểm tiếp theo rồi chụm. Với Điểm/Trung điểm/Xóa/Nét: chỉ vào mục tiêu rồi chụm. Ứng dụng giữ mục tiêu ở lúc bắt đầu chụm để hạn chế lệch khi khép ngón; mỗi lần chụm chỉ thực hiện một lệnh.
- **Độ nhạy:** ở tab **Cử Chỉ & Lưu → Hỗ trợ bắt điểm**, chọn **Chuẩn / Nhạy / Rất nhạy**. Mặc định là **Nhạy**, vùng bắt điểm 64 px, có giữ mục tiêu chống rung và xác nhận chụm 45 ms. Bộ lọc giảm ảnh hưởng sai số chiều sâu của hai đầu ngón tay.
- Bản mới thu ngắn vùng giữ mục tiêu khi rời điểm và chuyển sớm sang điểm tiếp theo khi ngón trỏ tới gần tâm điểm mới. Thả chụm kết thúc kéo ngay; điểm không tiếp tục đi theo ngón trỏ sau đó.
- Ngoài cách giữ/bấm ngón trỏ, công cụ **Nối đoạn** hỗ trợ hai lần chụm: chụm điểm đầu → thả → chỉ điểm cuối → chụm để nối. Không cần giữ tay đi theo cả đường. Giữ chụm không lặp lệnh; phải thả ổn định ít nhất 35 ms mới chuẩn bị lần chọn tiếp theo, hạn chế chọn hai lần do một khung nhận diện nhiễu. Chụm lại điểm đầu để hủy chuỗi.
- **Xoay tay.** Nút **Xoay tay · TẮT/BẬT** nằm dưới hình khi đã nhận diện tay. Xoay mặc định tắt. Bấm nút hoặc nhấn **R**, nắm một tay khoảng **320 ms** rồi rê ngang hoặc dọc. Khi bắt đầu rê, hình tự mở khóa mặt sàn. Mở tay hoặc bấm tắt để giữ ngay góc hiện tại.
- **Thu phóng hai tay.** Nút **Thu phóng tay · TẮT/BẬT** điều khiển riêng cử chỉ này. Mở hai bàn tay hướng về Camera và tách nhẹ trong khoảng **200 ms**. Khi trạng thái chuyển xanh, đưa hai tay gần nhau để thu nhỏ hoặc tách ra để phóng to. Hạ một tay hoặc bấm tắt để giữ kích thước đang hiển thị.
- **Chỉnh trực tiếp.** Vào **⚙ → Góc nhìn**, dùng **← → ↑ ↓** để xoay theo từng bước hoặc **− / +** để thu nhỏ và phóng to. Các nút này dùng được khi Camera và nhận diện tay đang chạy.
- **Xòe một tay, rời tay hoặc mất tín hiệu:** khóa chuyển động. Hình không tiếp tục trôi theo bộ làm mượt.
- **Space:** tạm khóa / tiếp tục cử chỉ. Khi bị khóa thủ công, bấm nút **▶ Tiếp tục cử chỉ** hoặc Space. Khi chỉ chuyển cửa sổ/tab, ứng dụng khóa lúc rời đi và tự chuẩn bị lại khi trở về; vẫn cần đưa tay vào đúng tư thế và xác nhận mới điều khiển được.

Khi AI đang bật, giữ **chuột phải** để chỉnh góc nhìn trực tiếp. Ứng dụng tạm nhường thao tác cho chuột trong lúc giữ nút. Nút **Đứng thẳng** cũng dùng được khi cử chỉ đang tạm khóa. Nhấn **Space** để tạm khóa cử chỉ và thu phóng bằng cuộn chuột. Hai bàn tay mở ổn định và thay đổi khoảng cách sẽ điều khiển thu phóng bằng tay.

Trong chế độ Camera, việc bắt điểm chỉ dùng ngón trỏ. Chế độ bắt nhiều đầu ngón và chỉnh đốt tay ảo dành cho điều khiển thủ công, được khóa khi AI đang chạy.

FPS hiển thị là tốc độ vẽ hiện tại, không phải cam kết tốc độ nhận diện 60 FPS. Tắt Camera sẽ dừng các track. Nếu Camera hoặc mô hình lỗi, ứng dụng trở lại điều khiển bằng chuột.

Khung tay giả lập mặc định tắt trong chế độ chuột để không che hình. Khi bật Camera AI lần đầu, khung tay thật được bật nếu người dùng chưa tự chọn ẩn/hiện. Nút **Khung tay** xuất hiện khi Camera AI đang chạy để bật/tắt lớp khung tay.

Bản mới ưu tiên **MediaPipe Hand Landmarker trong Web Worker**, theo mẫu worker chính thức của Google: xử lý tối đa một khung hình mỗi lần, giảm ảnh đầu vào về tối đa 640 px chiều rộng, đóng ImageBitmap sau khi dùng; GPU có nhánh dự phòng CPU. Trình duyệt không hỗ trợ worker này sẽ thử bộ Hands cũ. Kết quả trễ quá 280 ms không được dùng điều khiển; mất tín hiệu sẽ khóa chuyển động. Lượt xử lý đầu có thể chậm do khởi tạo mô hình/shader.

Danh tính tay được ghép theo vị trí lòng bàn tay qua các khung hình, thay vì nhãn Left/Right dễ đổi khi xoay tay. Điểm tin cậy phân loại tay trái/phải không bị dùng nhầm thành độ tin cậy hiện diện bàn tay; ngưỡng hiện diện/nhận diện được cấu hình trong mô hình. Các luật nắm tay xoay và hai tay mở zoom vẫn được giữ.

Pipeline mới truyền cả **worldLandmarks** từ mô hình về bộ phân tích. Góc PIP/DIP, tỉ lệ chiều dài đường xương và khoảng cách tới lòng bàn tay được tính trong hệ tọa độ 3D; phép chiếu màn hình chỉ điều khiển con trỏ. Nếu nhánh dự phòng không có worldLandmarks, bộ phân tích dùng tọa độ x/y/z của các mốc và kiểm tra hình học thận trọng hơn. Không dùng diện tích 2D nhỏ để kết luận tay đã nắm. Chuyển động xoay lấy chênh lệch tâm tay giữa hai khung hình, tránh đổi kích thước lòng bàn tay bị hiểu thành rê tay.

Đã thử mô hình thật trên ảnh mẫu hai tay của Google, các chuỗi tư thế mô phỏng và Pointer Events trên Chrome. Chưa thử trực tiếp webcam/ánh sáng/tư thế của từng người dùng; không cam kết mọi góc bị che khuất đều nhận được. Khi thiếu bằng chứng, ứng dụng giữ hình đứng yên.

## Hiệu chuẩn và chất lượng nhận diện

Nút **Giữ để chọn** bật hoặc tắt việc xác nhận bằng cách giữ ngón trỏ. Khi bật, vòng quanh con trỏ hiển thị tiến độ. Chụm và bấm ngón trỏ vẫn dùng được khi tắt chế độ giữ. Mất tín hiệu ngắn giữ điểm đầu đang chờ nối và tạm ngừng các lệnh tay. Mất lâu hoặc đổi tay yêu cầu chỉ lại trước khi xác nhận.

Để so sánh hiệu năng, mở `http://localhost:3000/?baseline=1` và dùng cùng máy, nguồn camera, kích thước cửa sổ, góc nhìn và preset `S_ABCD`. Đợi camera ổn định rồi chạy `geometryBaseline.reset()` trong Console. Sau 10 giây, chạy `geometryBaseline.report()` để lấy p50, p95 và số mẫu trên 50 ms. Xem `handJitterPx` khi giữ yên. Trước mỗi lượt xác nhận đã định trước, gọi `geometryBaseline.expectPoint('A')` với tên điểm mong muốn. `geometryBaseline.wrongPoints` đếm các lượt xác nhận chọn nhầm và `correctPoints` đếm các lượt chọn đúng. Lượt không có xác nhận không được tính, nên ghi riêng nếu cần so sánh.

Báo cáo tải xuống ghi pipeline, delegate, lịch camera, kích thước mẫu và p95 của cửa sổ thích ứng. Tuổi mẫu bắt đầu khi ứng dụng nhận frame để xử lý và bao gồm chuẩn bị bitmap hoặc canvas. `workerInference` đo riêng thời gian chạy mô hình trong Worker. Với MediaPipe Hands dự phòng, báo cáo có thời gian từ lúc nhận frame đến callback và thời gian chuẩn bị canvas. Thư viện không báo riêng thời gian suy luận hay delegate của đường dự phòng.

Mở **⚙ → Cử chỉ → Tín hiệu bàn tay**. MediaPipe Hand Landmarker ước lượng tọa độ 3D từ hình Camera.

1. Bật Camera và nhận diện tay, rồi bấm **Hiệu chuẩn tay**. Các lệnh chọn/kéo/xoay được tạm khóa, hình giữ nguyên.
2. Mở một bàn tay hướng về Camera, giữ ổn định khoảng 1.2 giây và ít nhất 16 khung nhận diện hợp lệ.
3. Khi sang bước 2, chỉ một ngón trỏ và giữ yên thêm khoảng 1.2 giây. Mất tay, đổi tay hoặc dịch quá nhiều sẽ bắt đầu lại phần đang đo.
4. Hoàn thành sẽ lưu chỉ số rung tương đối, thời gian giữ và thời điểm hiệu chuẩn trong trình duyệt này. Hệ thống điều chỉnh vùng giữ con trỏ và vùng bắt điểm theo độ rung đo được. Thời gian giữ dao động khoảng 0.82–1.12 giây; công cụ Xóa vẫn chờ lâu hơn. Không lưu ảnh/video/chuỗi khớp của lượt hiệu chuẩn.

**Hủy hiệu chuẩn** giữ hồ sơ trước đó. **Đặt lại** xóa hồ sơ cá nhân và trở về mặc định; không thay đổi bài học. Tắt Camera sẽ hủy lượt hiệu chuẩn đang thực hiện. Nếu trình duyệt không cho lưu, thiết lập chỉ dùng trong phiên hiện tại.

Trạng thái hiển thị số khung **nhận diện/giây**, riêng với FPS vẽ hình. `ms xử lý` là thời gian suy luận do worker đo, không phải tổng độ trễ từ Camera tới màn hình. Khi nhánh nhận diện không có số đo này, giao diện ghi chưa đo.

Lớp giám sát chặn khung trùng/sai thứ tự, dữ liệu trễ và khớp không rõ. Với world landmarks, sự thay đổi đồng thời quá lớn của nhiều đoạn xương sẽ bị chặn; cần các mẫu liên tiếp nhất quán để thiết lập lại mốc theo dõi. Đây là phép kiểm tra hình học, không phải xác suất tin cậy do hãng công bố. Tay nghiêng vẫn bị giới hạn xoay/zoom theo luật hiện có.

**Báo cáo** xuất JSON gồm nguồn đầu vào, pipeline/delegate đang dùng, tốc độ nhận diện, thời gian xử lý, số khung chấp nhận/từ chối và thiết lập hiệu chuẩn. Không kèm dữ liệu học sinh, bài học, ảnh/video hay các mốc khớp. Báo cáo nằm trên máy, không tự gửi tới máy chủ.

## Hình 2D nhỏ, luôn đồng bộ

Mở **Tính chất** bên phải, chọn ba điểm rồi bấm **Dựng mặt phẳng → Cắt khối**. Danh sách báo kết quả cắt khối lồi, gồm thiết diện đa giác, trùng mặt, tiếp xúc điểm/cạnh và không giao. Mặt hoặc khối ngoài phạm vi hỗ trợ có thông báo riêng. Đa giác vàng dựng từ các đoạn nối vẫn là đa giác đồng phẳng.

Trong **Quan hệ**, hai danh sách phân biệt mặt hữu hạn với mặt phẳng vô hạn. Có thể tô giao tuyến hoặc phần chung của hai mặt. Bấm một kết luận để tô các đối tượng liên quan và xem căn cứ trong **Giải thích**. Kết quả ghi **Gần đúng** là phép đo trên hình hiện tại. Đề bài nhập tự do không tự tạo giả thiết.

Với hình chóp mẫu, dựng mặt phẳng qua M, K, E. Khi bốn điểm là trung điểm, bảng hiện M–K–E–P, hai mặt phẳng song song và tỉ số diện tích 1/4, thể tích 1/8. Mở **Hình 2D** để xem và xuất cùng thiết diện.

Trên màn hình rộng, khung **Hình 2D** rộng 220 px nằm ở góc phải, vùng vẽ 3D chừa riêng cột này. Trên điện thoại, bấm **Hình 2D** để mở khung nhỏ 148 px; bấm × để ẩn. Khung chỉ có hình và vài nút gọn, không có phần hướng dẫn dài hay chế độ giữ trang.

- Cùng một nguồn tọa độ, tên đỉnh, điểm chia đoạn và đường dựng với mô hình 3D; chỉnh điểm, nối cạnh hoặc đổi hình sẽ cập nhật bản vẽ.
- Mặc định **Theo 3D**: phép chiếu song song lấy góc nhìn của mô hình 3D. Xoay hình sẽ xoay bản 2D tương ứng; thay điểm, thêm đường, đổi kiểu nét, hoàn tác hoặc đổi khối đều cập nhật ngay. Hình 2D tự canh vừa khung nhỏ khi góc nhìn thay đổi, giữ thẳng hàng và tỉ lệ chia đoạn.
- Nét liền / nét đứt được tính lại theo góc nhìn đang dùng. Các nhãn phụ được lược bớt trên khung nhỏ để dễ nhìn; bản xuất ảnh giữ đầy đủ nhãn.
- Bấm **Theo 3D ↔** để chuyển sang **Góc chuẩn** khi muốn hình chép vở có hướng cố định. Ở chế độ này, các thay đổi điểm và đường của 3D vẫn đồng bộ; chỉ góc nhìn được giữ riêng.
- Tỉ lệ chia cạnh, ví dụ `M ∈ SD · SM/SD = 0.5`, có trong bản xuất. Diện tích thiết diện lấy từ tọa độ 3D, ghi bằng đơn vị diện tích quy ước.
- **↓ SVG** xuất bản vẽ vector; **↓ PNG** xuất ảnh 1400 × 1000 px, gồm lưới vở và chú giải. Có thể chèn vào tài liệu hoặc in để học sinh tham khảo.

Không đo góc thật hay độ dài thật trực tiếp trên hình chiếu. Góc nhìn và hệ số thu ngắn làm những đại lượng này thay đổi trên trang giấy; tên điểm, quan hệ thuộc cạnh và tỉ lệ chia cạnh mới là dữ kiện để dựng hình.

## Lưu giáo án

### Bản nháp phục hồi

Sau khi chỉnh hình, ứng dụng đợi khoảng 1.2 giây rồi tự lưu bản nháp trong trình duyệt trên máy này; đang kéo thì đợi kết thúc. Chỉ xoay hoặc zoom không gây ghi lại liên tục. Khi tải lại trang, nếu có bản nháp khác bài mặc định, thanh **Khôi phục** xuất hiện ngay trong vùng công cụ. Bấm Khôi phục để lấy lại điểm, quan hệ, khóa và nét; bấm × để bỏ qua bản nháp cũ. Bài đang mở không tự bị thay thế.

Bản nháp độc lập với **Lưu Bài** và kho giáo án. Nó không đồng bộ sang máy khác; hãy dùng giáo án/JSON để giữ bản chính. Nếu trình duyệt chặn lưu trữ hoặc hết dung lượng, thanh trạng thái báo không tự lưu được và gợi ý xuất JSON; hình vẫn chỉnh được trong phiên hiện tại.

**Lưu Bài / Mở Bài** dùng bản lưu nhanh của trình duyệt. **Giáo Án → Lưu Vào Kho** tạo nhiều giáo án riêng. Bản lưu giữ tọa độ, điểm chia đoạn, mặt/cạnh, kiểu nét, hình tự tạo, góc nhìn và hướng chiếu chép vở.

Trong **Giáo Án**, dùng **Xuất JSON / Nhập JSON** để sao lưu hoặc chuyển bài sang máy khác. Nếu trình duyệt chặn lưu trữ, ứng dụng giữ bài trong phiên và thông báo rõ; hãy xuất JSON trước khi đóng trang.

Để lưu trên máy chủ:

1. Chạy `node server.mjs` và mở trang localhost như trên.
2. Mở **Giáo Án**, bấm **Kết nối & Tải**. Nút này tải bài trên API và giữ các bài cục bộ.
3. Giáo án tạo mới sau khi kết nối được lưu qua API. Các bài cục bộ có sẵn không tự được tải lên; mở bài rồi lưu thành giáo án mới nếu cần.
4. Máy chủ mặc định lưu bền vững tại `data/lessons.json`. Khởi động lại máy chủ vẫn giữ dữ liệu. API chỉ lắng nghe trên máy này theo cấu hình mặc định.

## PostgreSQL tùy chọn

Đã có adapter PostgreSQL và `schema.sql`. Nhánh này cần một cơ sở dữ liệu PostgreSQL do bạn cung cấp; chưa được kiểm chứng với một máy chủ PostgreSQL thật trong lần sửa này.

Các lệnh PowerShell:

```powershell
npm install
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/webar_geometry'
node server.mjs
```

Ứng dụng tạo bảng trong `schema.sql` nếu chưa tồn tại. `.env.example` chỉ là mẫu; `npm start` không tự đọc `.env`. Nếu muốn dùng file `.env`, chạy `node --env-file=.env server.mjs` với bản Node hỗ trợ tùy chọn này.

## Bản gốc và kiểm chứng

- `backups/TEST2.before-fix.html`: bản TEST2 trước khi sửa.
- `backups/TEST2.before-gesture-notebook-upgrade.html`: bản trước khi nâng cấp cử chỉ và hình chép vở.
- `backups/TEST2.before-selection-compact-upgrade.html`: bản trước khi tăng độ nhạy chọn/nối điểm và thu gọn hình 2D.
- `backups/TEST2.before-object-system-rebuild.html`: bản trước khi xây lại hệ thống điểm/đường và tích hợp nhận diện chạy nền.
- `backups/TEST2.before-occlusion-gesture-upgrade.html`: bản trước khi thay thuật toán che khuất và bổ sung chọn công cụ bằng tay.
- `backups/TEST2.before-studio-upgrade.html`: bản trước nâng cấp chuyển động, thuộc tính, bố cục Studio và phục hồi bản nháp.
- `backups/TEST2.before-spatial-workspace.html`: bản trước khi chuyển bảng ra mép màn hình, thêm chiều sâu và đổi luồng chuột mặc định.
- `backups/TEST2.before-magnetic-connections.html`: bản trước khi thống nhất bấm/chụm hai điểm, thêm bắt điểm bằng chuột và xem trước nét thật.
- `backups/TEST2.before-hand-intent-rebuild.html`: bản trước khi dùng khớp tay 3D, chọn/kéo bằng ngón trỏ, mốc độ mở và khóa xoay mặc định.
- `backups/TEST2.before-tracking-quality-calibration.html`: bản trước khi bổ sung giám sát chất lượng, hiệu chuẩn và báo cáo chẩn đoán.
- `TESTSTUDY.html`, `TESTSTUDY`, `IDEA.txt`, `VIDEO.mov`: giữ nguyên.
- `npm test`: kiểm tra hình học, cử chỉ, lưu/khôi phục và API, gồm lưu dữ liệu qua lần khởi động lại.
- `npm run test:browser`: kiểm tra trong Chrome headless, bao gồm bấm chấm/nhãn, kéo và Undo cho đủ 9 trung điểm; thêm/xóa điểm và đoạn; danh sách, cảm ứng; cử chỉ 21 khớp mô phỏng; chống zoom/xoay nhầm; xuất ảnh và giao diện desktop/mobile. Công cụ mặc định tìm Chrome tại thư mục cài chuẩn trên Windows; có thể đặt `CHROME_PATH`.
- `node qa/model-smoke.mjs`: tải mô hình Hand Landmarker thật vào worker, nhận diện ảnh mẫu hai tay của Google. Lượt kiểm chứng nhận được **2 tay × 21 khớp**; ba lượt sau khởi động khoảng **94–124 ms**, trong khi luồng giao diện vẫn chạy. Đây là số đo Chrome headless của lần kiểm tra, không phải cam kết FPS trên máy khác. Chi tiết tại `qa/model-results.json`.
- `node qa/ai-video.mjs`: kiểm tra khung hình giải mã từ VIDEO.mov bằng mô hình mới. Lượt hiện tại nhận được một tay đủ 21 mốc ở giây 18; chưa tìm được tay ở giây 8, 30 và 40. Kết quả lưu ở `qa/ai-results.current.json`; bốn khung hình rời không đủ để kết luận độ chính xác hay độ mượt toàn video/webcam.
- `qa/visibility.test.mjs` kiểm tra che khuất, xoay 180°, đoạn bị che một phần và toàn bộ các khối mẫu qua nhiều góc xoay. `qa/visibility-browser-checks.mjs` xác nhận nét thực tế trên canvas và SVG, gồm xoay bằng nút chuột phải. Ảnh hai góc tại `qa/visibility-front.png` và `qa/visibility-back.png`.
- `qa/studio.test.mjs`: kiểm tra chuyển động ở 30/60/120 FPS, công thức phối cảnh chính xác, mặt phẳng kéo, khóa/đổi tên, bố trí nhãn và lỗi lưu trữ. `qa/studio-browser-checks.mjs`: thao tác chuột/phím/UI thật, API và phục hồi sau reload; ảnh tại `qa/studio-desktop.png` và `qa/studio-presentation.png`.
- `qa/spatial-browser-checks.mjs`: xác nhận bấm trái chọn điểm, giữ trái kéo nối có xem trước, hủy bằng Esc/thả ở vùng trống, không trùng nét, Undo và xoay phải theo cả hai chiều. Ảnh giao diện mới tại `qa/spatial-workspace.png`, `qa/spatial-depth.png`; ảnh mobile tại `qa/mobile.png`.

Giao diện dùng phông hệ thống và CSS đóng gói; khởi động thủ công không phải chờ máy chủ phông chữ ngoài. Bản 2D khi xoay được cập nhật tối đa khoảng 30 lần/giây để giảm dựng lại SVG; thay đổi trực tiếp từ công cụ và xuất ảnh vẫn cập nhật ngay. Chuyển động 3D tính theo thời gian thực, không lấy số khung hình làm tốc độ xoay.

Webcam vật lý và kết nối PostgreSQL thật chưa được kiểm tra. Các kiểm tra cử chỉ mô phỏng xác nhận luật điều khiển, không thay thế đánh giá MediaPipe với ánh sáng, góc tay và Camera thực tế. Kết quả kiểm tra trình duyệt lưu tại `qa/results.json`; ảnh tại `qa/upgrade-final.png`, `qa/object-system.png`, `qa/mobile.png`; bản xuất ảnh tại `qa/notebook-export.png` và `qa/notebook-export.svg`. Các mô hình tham khảo và cách áp dụng được ghi trong `THAM_KHAO.md`.
