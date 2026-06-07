# Thiết Kế Tối Ưu Cho App Mobile Chuyển Audio Dài 60–100 Phút Thành Text

## Mục tiêu

Tài liệu này mô tả kiến trúc production-grade cho app mobile chuyển âm thanh dài thành văn bản với các mục tiêu đồng thời:

- Không crash trên iPhone đời cũ và Android RAM 6–8GB
- Tối ưu chi phí API STT
- Hạn chế retry và upload lại dữ liệu
- Lưu transcript ngay theo từng batch
- Resume được nếu app bị kill hoặc mất mạng
- Tăng trải nghiệm người dùng bằng transcript xuất hiện dần
- Dễ triển khai bằng Codex / dev team

---

# 1. Bài toán thực tế

Nếu làm ngây thơ theo cách:

```text
Audio 60–100 phút
→ chia 8–10 phút
→ gọi API từng đoạn
→ ghép kết quả cuối cùng
```

thì sẽ gặp các vấn đề:

- Quá nhiều request API
- Tốn tiền do overhead upload / retry
- Dễ crash nếu giữ nhiều buffer trong RAM
- iOS có thể kill app nền
- Mất toàn bộ tiến độ nếu app bị đóng giữa chừng
- UI có thể bị đơ nếu giữ transcript lớn trong memory

Bản chất của bài toán không chỉ là “chia file”, mà là tối ưu đồng thời 5 thứ:

| Mặt cần tối ưu | Rủi ro nếu làm sai |
|---|---|
| RAM | Crash |
| CPU / nhiệt độ | Bị hệ điều hành kill |
| API billing | Lỗ tiền |
| Network / retry | Tốn thêm request |
| Resume / checkpoint | Mất toàn bộ tiến độ |

---

# 2. Nguyên tắc kiến trúc

Kiến trúc đúng phải tách thành 2 lớp:

## Lớp 1: Micro-chunk
Mục tiêu:

- bảo vệ RAM
- giảm spike bộ nhớ
- xử lý an toàn trên mobile

## Lớp 2: Macro-batch
Mục tiêu:

- giảm số lần gọi API
- giảm chi phí request
- giảm retry tốn tiền

Nói cách khác:

> **Chunk nhỏ để máy sống sót, batch lớn để tiết kiệm API.**

---

# 3. Kiến trúc tổng thể

```text
[AUDIO GỐC]
     ↓
[Normalize: mono + 16kHz + nén nhẹ]
     ↓
[Local VAD / silence detection]
     ↓
[Micro-chunk 3–5 phút]
     ↓
[Rolling buffer trên disk]
     ↓
[Đủ 20–25 phút speech-only]
     ↓
[1 API call lớn]
     ↓
[Nhận transcript]
     ↓
[Lưu transcript ngay theo batch]
     ↓
[Checkpoint trạng thái]
     ↓
[Cleanup RAM + xóa temp]
     ↓
[Chạy batch kế tiếp]
```

---

# 4. Kích thước chunk khuyến nghị

## Micro-chunk
Dùng cho xử lý nội bộ trên device.

| Thiết bị | Micro-chunk |
|---|---|
| iPhone cũ | 2–4 phút |
| Android RAM 6GB | 3–5 phút |
| Android mạnh hơn | 5–7 phút |

## Macro-batch
Dùng để gọi API.

| Điều kiện | Macro-batch |
|---|---|
| Mạng yếu | 10–15 phút |
| Mạng ổn | 20 phút |
| WiFi mạnh | 20–25 phút |
| Rất ổn / tối ưu API | 25–30 phút |

### Khuyến nghị mặc định
- **Micro-chunk**: 3–5 phút
- **Macro-batch**: 20–25 phút

---

# 5. Vì sao không nên call API mỗi 8–10 phút

Nếu 100 phút audio chia thành 10 batch và call 10 lần:

- Tăng chi phí request
- Tăng nguy cơ fail từng batch
- Tăng số lần upload
- Tăng rủi ro phải retry
- Tăng thời gian tổng nếu mạng không ổn

Điểm quan trọng là:

> **Chunk để xử lý nội bộ không bắt buộc phải trùng với chunk để gọi API.**

App nên cắt nhỏ để an toàn, nhưng có thể **gom lại** trước khi call API.

---

# 6. Speech-only upload

Một trong những cách tiết kiệm tiền tốt nhất là **không upload phần im lặng**.

## Dùng VAD
Dùng Voice Activity Detection để xác định vùng có giọng nói.

Ví dụ pipeline:

```text
Audio
↓
VAD detect
↓
Bỏ silence
↓
Giữ speech segments
↓
Gom thành macro-batch
↓
Upload API
```

### Lợi ích
- Giảm số phút phải gửi lên API
- Giảm chi phí
- Transcript tự nhiên hơn
- Ít bị cắt giữa các đoạn im lặng

---

# 7. Không xử lý song song nhiều chunk

## Sai
```js
Promise.all(chunks.map(transcribe))
```

## Đúng
- Chỉ chạy **1 worker**
- Mỗi thời điểm chỉ có 1 chunk active
- Không giữ nhiều audio buffer cùng lúc

### Lý do
STT + upload + decode audio đều là workload nặng. Chạy song song trên mobile dễ gây:

- spike RAM
- nóng máy
- lag UI
- crash

---

# 8. Rolling buffer trên disk

Đừng merge audio trong RAM.

## Sai
```js
fullAudioBuffer += chunkAudio
```

## Đúng
- Lưu chunk tạm trên disk
- Append binary/file theo batch
- Khi đủ ngưỡng thì upload batch đó

Ví dụ file tạm:

```text
batch_001.temp
batch_002.temp
batch_003.temp
```

---

# 9. Transcript phải lưu ngay theo từng batch

Đây là phần quan trọng nhất.

## Không được làm
Đợi xử lý xong toàn bộ rồi mới lưu transcript.

## Phải làm
Khi batch nào xong thì lưu ngay batch đó.

### Logic đúng
```text
Batch 1 xong → save ngay
Batch 2 xong → append tiếp
Batch 3 xong → append tiếp
```

### Lợi ích
- Crash không mất kết quả đã xong
- Không phải chạy lại từ đầu
- Không phải upload lại phần cũ
- Giảm lỗ tiền API
- Resume rất đơn giản

---

# 10. Mô hình lưu transcript nên là append-only

## Không nên
```text
full_text = full_text + new_text
```
trong memory dài hạn.

## Nên
Lưu từng batch riêng, sau đó ghép khi cần.

### Ví dụ dữ liệu
```json
[
  {
    "job_id": "job_001",
    "batch_index": 1,
    "start_ms": 0,
    "end_ms": 1200000,
    "text": "..."
  },
  {
    "job_id": "job_001",
    "batch_index": 2,
    "start_ms": 1200000,
    "end_ms": 2400000,
    "text": "..."
  }
]
```

---

# 11. Schema đề xuất cho SQLite

## Bảng jobs
```sql
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    source_audio_path TEXT NOT NULL,
    status TEXT NOT NULL,
    current_batch INTEGER NOT NULL DEFAULT 0,
    total_batches INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

## Bảng batches
```sql
CREATE TABLE transcript_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    batch_index INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    audio_temp_path TEXT,
    upload_status TEXT NOT NULL,
    transcribe_status TEXT NOT NULL,
    save_status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);
```

## Ý nghĩa trạng thái
- `upload_status`: pending / uploaded / failed
- `transcribe_status`: pending / done / failed
- `save_status`: pending / saved / failed

---

# 12. Resume logic sau crash

## Nguyên tắc
App phải biết chính xác:

- đang dở batch nào
- batch nào đã upload
- batch nào đã transcribe
- batch nào đã save transcript
- batch nào đang lỗi

## Khi mở lại app
- Đọc `jobs.current_batch`
- Query batch gần nhất có `save_status = saved`
- Tiếp tục từ batch kế tiếp
- Không xử lý lại batch đã save

### Đây là điểm giúp không phải chạy lại từ đầu.

---

# 13. Retry logic

## Retry theo batch
Nếu một batch lỗi:

- chỉ retry batch đó
- không restart toàn bộ job

## Exponential backoff
Ví dụ:

| Lần retry | Delay |
|---|---|
| 1 | 5 giây |
| 2 | 15 giây |
| 3 | 45 giây |
| 4 | 2 phút |

## Không retry vô hạn
Nếu batch fail quá nhiều:
- đánh dấu batch lỗi
- cho user chọn retry tay
- hoặc resume sau

---

# 14. Background-safe processing

## Android
Nên dùng:
- WorkManager
- Foreground Service cho job dài

## iOS
Nên dùng:
- BackgroundTasks
- checkpoint thường xuyên
- tránh giữ work quá lâu trong memory

---

# 15. UI / UX tốt nhất

Không nên đợi xong toàn bộ mới hiện text.

## Nên làm progressive transcript
Ví dụ:

```text
✓ 00:00–25:00 đã xong
⟳ 25:00–50:00 đang xử lý
```

### Lợi ích
- User thấy app đang làm việc
- Cảm giác nhanh hơn
- Có thể copy / review phần đã xong sớm

---

# 16. Adaptive batch sizing

Batch size nên thay đổi theo điều kiện máy và mạng.

| Điều kiện | Batch khuyến nghị |
|---|---|
| WiFi mạnh, máy ổn | 25–30 phút |
| Mạng trung bình | 20 phút |
| Mạng yếu | 10–15 phút |
| RAM thấp / máy cũ | giảm xuống 10–15 phút |

### Công thức tư duy
Batch size = min(
- độ ổn định mạng,
- giới hạn timeout API,
- mức chịu tải của device,
- rủi ro retry
)

---

# 17. Tổng thời gian ra kết quả

## Mục tiêu thực tế
Với cloud STT mạnh:

- 60 phút audio: khoảng 1.5–3 phút
- 100 phút audio: khoảng 3–6 phút

### Lưu ý
Đây là thời gian end-to-end nếu:
- upload ổn
- STT nhanh
- batching hợp lý
- có speech-only upload

## Không nên hiểu nhầm
Đây **không phải** là thời gian “xử lý audio theo thời lượng thật”.
Cloud STT hiện đại thường nhanh hơn realtime.

---

# 18. Timeline mẫu

## Ví dụ audio 100 phút

Sau VAD:
- còn khoảng 70–80 phút speech

Batch:
- 25 phút
- 25 phút
- 20 phút

### Diễn biến
```text
0:00   Start job
0:20   Batch 1 upload xong
0:45   Batch 1 transcript lưu xong
1:15   Batch 2 transcript lưu xong
2:10   Batch 3 transcript lưu xong
2:20   Merge final text hoàn tất
```

---

# 19. Final merge

Khi user cần xem full transcript:

- Query toàn bộ batch theo `batch_index`
- Ghép theo thứ tự
- Không cần load tất cả vào RAM nếu text quá lớn
- Có thể stream ra file final

### Lưu ý
Final merge chỉ là bước trình bày, không phải bước xử lý nặng.

---

# 20. Những điều không nên làm

- Không upload toàn bộ 60–100 phút một lần
- Không chạy nhiều worker song song
- Không giữ transcript full trong RAM
- Không merge audio trong memory
- Không retry toàn bộ job khi một batch lỗi
- Không thiếu checkpoint
- Không lưu trạng thái chỉ trong UI state

---

# 21. Kiến trúc khuyến nghị cuối cùng

## Tên kiến trúc
**Dual-layer chunking + disk-backed checkpoint + append-only transcript**

## Công thức
```text
Micro chunk
→ Rolling buffer
→ Macro batch
→ 1 API call
→ Save transcript ngay
→ Update checkpoint
→ Cleanup
→ Resume safe
```

---

# 22. Checklist cho Codex / Dev

## Must have
- [x] Normalize audio
- [x] Local VAD / silence detection
- [x] Micro-chunk 3–5 phút
- [x] Macro-batch 20–25 phút
- [x] 1 worker duy nhất
- [x] Rolling buffer trên disk
- [x] Save transcript theo batch ngay lập tức
- [x] SQLite checkpoint
- [x] Resume logic
- [x] Retry theo batch
- [x] Progressive transcript UI
- [x] Cleanup temp files
- [x] Background-safe scheduling

## Nice to have
- [ ] Adaptive batch sizing theo mạng/máy
- [ ] Sync cloud theo từng batch
- [ ] Export subtitle / SRT / VTT
- [ ] Auto-detect language
- [ ] Autosave versioning

---

# 23. Pseudocode logic

```pseudo
function processJob(audioFile):
    normalize(audioFile)
    speechSegments = runVAD(audioFile)
    microChunks = makeMicroChunks(speechSegments)

    while hasMoreMicroChunks():
        batch = buildMacroBatchFromMicroChunks(target=20-25min)

        uploadResult = uploadBatch(batch)
        if uploadResult.failed:
            retryCurrentBatchOnly()
            continue

        transcript = transcribe(uploadResult)
        if transcript.failed:
            retryCurrentBatchOnly()
            continue

        saveTranscriptImmediately(jobId, batchIndex, transcript)
        updateCheckpoint(jobId, batchIndex)
        cleanupTempFiles(batch)

    finalizeJob(jobId)
```

---

# 24. Kết luận

Phương án tối ưu nhất không phải là “cắt file nhỏ rồi gọi API nhiều lần”, mà là:

## 1. Cắt nhỏ để chạy an toàn trên mobile  
## 2. Gom lớn để giảm số API call  
## 3. Lưu transcript ngay sau từng batch  
## 4. Có checkpoint để resume  
## 5. Chỉ retry batch lỗi  
## 6. Chỉ 1 worker active tại một thời điểm

### Tóm gọn 1 câu
> **Micro chunk để sống sót, macro batch để tiết kiệm tiền, checkpoint để không mất dữ liệu.**
