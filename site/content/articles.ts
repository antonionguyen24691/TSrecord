export type ArticleSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SiteArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  featured?: boolean;
  sections: ArticleSection[];
};

export const articles: SiteArticle[] = [
  {
    slug: 'chuyen-ghi-am-thanh-van-ban-chinh-xac',
    title: 'Cách chuyển ghi âm thành văn bản rõ ràng và dễ kiểm tra',
    description:
      'Quy trình chuẩn bị âm thanh, chọn chế độ phiên âm và rà soát kết quả để giảm thời gian biên tập.',
    category: 'Hướng dẫn',
    publishedAt: '2026-06-07',
    updatedAt: '2026-06-07',
    readingMinutes: 6,
    featured: true,
    sections: [
      {
        heading: 'Bắt đầu từ chất lượng nguồn âm',
        paragraphs: [
          'Một công cụ nhận dạng giọng nói tốt vẫn cần đầu vào đủ rõ. Hãy đặt thiết bị gần người nói, hạn chế tiếng quạt và tránh để nhiều người nói chồng lên nhau.',
          'Nếu tệp quá dài, chia theo từng phần có chủ đề rõ ràng sẽ giúp việc kiểm tra và tiếp tục xử lý thuận tiện hơn.',
        ],
      },
      {
        heading: 'Chọn đúng kiểu kết quả',
        paragraphs: [
          'Bản có mốc thời gian phù hợp khi cần đối chiếu lại video, cuộc họp hoặc phỏng vấn. Bản văn bản liền mạch phù hợp khi mục tiêu là biên tập thành tài liệu đọc.',
        ],
        bullets: [
          'Giữ nguyên ngôn ngữ gốc nếu nội dung có thuật ngữ chuyên ngành.',
          'Dùng ngữ cảnh cuộc họp khi cần quyết định và đầu việc.',
          'Dùng ngữ cảnh phỏng vấn khi cần phân tách câu hỏi và câu trả lời.',
        ],
      },
      {
        heading: 'Luôn rà soát tên riêng và số liệu',
        paragraphs: [
          'Tên người, tên sản phẩm, số tiền và mốc thời gian là các phần nên được kiểm tra lại với nguồn âm. Đây cũng là lý do bản phiên âm cần có cấu trúc dễ tìm và dễ chỉnh sửa.',
        ],
      },
    ],
  },
  {
    slug: 'ghi-chep-cuoc-hop-bang-ai',
    title: 'Ghi chép cuộc họp bằng AI: nên tự động hóa phần nào?',
    description:
      'Phân biệt phần có thể giao cho AI và phần vẫn cần người phụ trách xác nhận sau cuộc họp.',
    category: 'Năng suất',
    publishedAt: '2026-06-05',
    updatedAt: '2026-06-07',
    readingMinutes: 5,
    sections: [
      {
        heading: 'Tự động hóa phần ghi nhận',
        paragraphs: [
          'Phiên âm, nhóm chủ đề và trích xuất đầu việc là những phần tốn thời gian nhưng có thể chuẩn hóa. Người tham gia nhờ đó tập trung vào trao đổi thay vì vừa nghe vừa ghi.',
        ],
      },
      {
        heading: 'Không tự động hóa trách nhiệm',
        paragraphs: [
          'AI có thể đề xuất danh sách quyết định và đầu việc, nhưng người chủ trì vẫn cần xác nhận nội dung cuối cùng, người phụ trách và hạn hoàn thành.',
        ],
        bullets: [
          'Gửi biên bản sớm sau khi cuộc họp kết thúc.',
          'Đánh dấu nội dung chưa thống nhất thay vì tự suy diễn.',
          'Lưu bản ghi và biên bản theo cùng một dự án.',
        ],
      },
    ],
  },
  {
    slug: 'bao-mat-du-lieu-ghi-am',
    title: 'Bảo mật dữ liệu ghi âm khi sử dụng dịch vụ AI',
    description:
      'Những câu hỏi cần kiểm tra về quyền truy cập, khóa API, thời gian lưu trữ và dữ liệu nhạy cảm.',
    category: 'Bảo mật',
    publishedAt: '2026-06-02',
    updatedAt: '2026-06-07',
    readingMinutes: 7,
    sections: [
      {
        heading: 'Xác định dữ liệu nào được phép tải lên',
        paragraphs: [
          'Trước khi xử lý, cần phân loại bản ghi có chứa thông tin khách hàng, dữ liệu nội bộ hoặc nội dung thuộc thỏa thuận bảo mật hay không.',
        ],
      },
      {
        heading: 'Quản lý khóa truy cập',
        paragraphs: [
          'Khóa API không nên được chia sẻ trong tài liệu hoặc mã nguồn công khai. Với thiết bị cá nhân, nên lưu khóa trong vùng lưu trữ bảo mật của hệ điều hành.',
        ],
      },
      {
        heading: 'Thiết lập quy trình xóa và lưu trữ',
        paragraphs: [
          'Tổ chức nên có thời hạn lưu bản ghi, người được phép truy cập và cách xử lý khi người dùng yêu cầu xóa dữ liệu.',
        ],
      },
    ],
  },
  {
    slug: 'so-sanh-phien-am-co-moc-thoi-gian',
    title: 'Khi nào nên dùng phiên âm có mốc thời gian?',
    description:
      'Các trường hợp mốc thời gian giúp kiểm chứng nội dung, dựng video và trích dẫn chính xác hơn.',
    category: 'Kiến thức',
    publishedAt: '2026-05-29',
    updatedAt: '2026-06-07',
    readingMinutes: 4,
    sections: [
      {
        heading: 'Đối chiếu nhanh với nguồn',
        paragraphs: [
          'Mốc thời gian giúp người biên tập quay lại đúng đoạn âm thanh thay vì nghe lại toàn bộ tệp. Điều này đặc biệt hữu ích với phỏng vấn, nghiên cứu và nội dung pháp lý cần kiểm chứng.',
        ],
      },
      {
        heading: 'Tạo phụ đề và nội dung ngắn',
        paragraphs: [
          'Khi sản xuất video, mốc thời gian là nền tảng để chọn đoạn trích, tạo phụ đề và đánh dấu các phần nổi bật.',
        ],
      },
    ],
  },
];

export const getArticleBySlug = (slug: string) =>
  articles.find((article) => article.slug === slug);
