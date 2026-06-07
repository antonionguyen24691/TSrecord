import { query } from './database.js';

type ContentSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

const pages: Array<{
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  content: ContentSection[];
  metadata?: Record<string, unknown>;
}> = [
  {
    slug: 'gioi-thieu',
    title: 'Giới thiệu',
    eyebrow: 'Về TSrecord',
    description:
      'TSrecord được xây dựng để giảm thời gian nghe lại và giúp nội dung từ bản ghi đi tiếp vào công việc.',
    content: [
      {
        heading: 'Từ âm thanh rời rạc đến tri thức có thể sử dụng',
        paragraphs: [
          'TSrecord tập trung vào một quy trình rõ ràng: tiếp nhận bản ghi, tạo văn bản, kiểm tra kết quả và lưu lại theo dự án.',
          'Sản phẩm hỗ trợ người dùng xử lý phần việc lặp lại, nhưng không thay thế trách nhiệm xác minh đối với tên riêng, số liệu và quyết định quan trọng.',
        ],
      },
      {
        heading: 'Nguyên tắc phát triển',
        paragraphs: [
          'Chúng tôi thiết kế sản phẩm theo hướng minh bạch, tôn trọng ngôn ngữ gốc và cho phép người dùng kiểm soát kết quả cuối cùng.',
        ],
        bullets: [
          'Nội dung người dùng được xử lý đúng mục đích.',
          'Không tự ý dịch hoặc thay đổi ngôn ngữ của bản ghi.',
          'Website kiến thức phải hữu ích độc lập.',
          'Frontend và backend được tách rõ để thuận tiện vận hành.',
        ],
      },
    ],
  },
  {
    slug: 'lien-he',
    title: 'Liên hệ',
    eyebrow: 'Kết nối với đội ngũ',
    description:
      'Kênh tiếp nhận câu hỏi về sản phẩm, dữ liệu, hợp tác nội dung và quảng cáo.',
    content: [
      {
        heading: 'Hỗ trợ sản phẩm',
        paragraphs: [
          'Gửi mô tả ngắn về thiết bị, phiên bản ứng dụng và thao tác gây lỗi để đội ngũ có đủ thông tin kiểm tra.',
        ],
      },
      {
        heading: 'Yêu cầu dữ liệu',
        paragraphs: [
          'Với yêu cầu liên quan đến dữ liệu cá nhân, hãy ghi rõ “Yêu cầu dữ liệu” trong tiêu đề email để được phân loại đúng.',
        ],
      },
    ],
    metadata: {
      email: 'support@tsrecord.vn',
      region: 'Phục vụ trực tuyến tại Việt Nam và các thị trường được hỗ trợ.',
    },
  },
  {
    slug: 'chinh-sach-bao-mat',
    title: 'Chính sách bảo mật',
    eyebrow: 'Minh bạch dữ liệu',
    description:
      'Thông tin về dữ liệu được xử lý, mục đích sử dụng, lưu trữ và công nghệ quảng cáo.',
    content: [
      {
        heading: 'Thông tin được xử lý',
        paragraphs: [
          'Tùy tính năng, TSrecord có thể xử lý tệp âm thanh, video, tài liệu bổ sung, mã thiết bị, thông tin gói sử dụng và dữ liệu kỹ thuật cần thiết để cung cấp dịch vụ.',
        ],
      },
      {
        heading: 'Mục đích sử dụng',
        paragraphs: [
          'Dữ liệu được dùng để thực hiện yêu cầu phiên âm, lưu không gian làm việc, xác định quyền sử dụng, hỗ trợ kỹ thuật và bảo vệ hệ thống trước hành vi lạm dụng.',
        ],
      },
      {
        heading: 'Quyền của người dùng',
        paragraphs: [
          'Người dùng có thể yêu cầu giải thích, chỉnh sửa hoặc xóa dữ liệu thuộc phạm vi TSrecord kiểm soát qua trang Liên hệ.',
        ],
      },
    ],
  },
  {
    slug: 'dieu-khoan',
    title: 'Điều khoản sử dụng',
    eyebrow: 'Quy tắc sử dụng',
    description:
      'Các nguyên tắc cơ bản khi sử dụng website, ứng dụng và nội dung của TSrecord.',
    content: [
      {
        heading: 'Phạm vi dịch vụ',
        paragraphs: [
          'TSrecord cung cấp công cụ hỗ trợ xử lý âm thanh và tổ chức văn bản. Kết quả do AI tạo ra có thể có sai sót và cần được kiểm tra trước khi dùng cho quyết định quan trọng.',
        ],
      },
      {
        heading: 'Trách nhiệm nội dung',
        paragraphs: [
          'Người dùng phải có quyền xử lý tệp được tải lên và không sử dụng dịch vụ để xâm phạm quyền riêng tư, quyền sở hữu trí tuệ hoặc pháp luật hiện hành.',
        ],
      },
      {
        heading: 'Thay đổi dịch vụ',
        paragraphs: [
          'Tính năng và điều khoản có thể được cập nhật để đáp ứng yêu cầu kỹ thuật, pháp lý hoặc vận hành.',
        ],
      },
    ],
  },
];

const articles = [
  {
    slug: 'chuyen-ghi-am-thanh-van-ban-chinh-xac',
    title: 'Cách chuyển ghi âm thành văn bản rõ ràng và dễ kiểm tra',
    description:
      'Quy trình chuẩn bị âm thanh, chọn chế độ phiên âm và rà soát kết quả để giảm thời gian biên tập.',
    category: 'Hướng dẫn',
    readingMinutes: 6,
    featured: true,
    publishedAt: '2026-06-07',
    content: [
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
    ],
  },
  {
    slug: 'ghi-chep-cuoc-hop-bang-ai',
    title: 'Ghi chép cuộc họp bằng AI: nên tự động hóa phần nào?',
    description:
      'Phân biệt phần có thể giao cho AI và phần vẫn cần người phụ trách xác nhận sau cuộc họp.',
    category: 'Năng suất',
    readingMinutes: 5,
    featured: true,
    publishedAt: '2026-06-05',
    content: [
      {
        heading: 'Tự động hóa phần ghi nhận',
        paragraphs: [
          'Phiên âm, nhóm chủ đề và trích xuất đầu việc là những phần tốn thời gian nhưng có thể chuẩn hóa.',
        ],
      },
      {
        heading: 'Không tự động hóa trách nhiệm',
        paragraphs: [
          'AI có thể đề xuất danh sách quyết định và đầu việc, nhưng người chủ trì vẫn cần xác nhận nội dung cuối cùng, người phụ trách và hạn hoàn thành.',
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
    readingMinutes: 7,
    featured: true,
    publishedAt: '2026-06-02',
    content: [
      {
        heading: 'Xác định dữ liệu nào được phép tải lên',
        paragraphs: [
          'Trước khi xử lý, cần phân loại bản ghi có chứa thông tin khách hàng, dữ liệu nội bộ hoặc nội dung thuộc thỏa thuận bảo mật hay không.',
        ],
      },
      {
        heading: 'Quản lý khóa truy cập',
        paragraphs: [
          'Khóa API không nên được chia sẻ trong tài liệu hoặc mã nguồn công khai.',
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
    readingMinutes: 4,
    featured: false,
    publishedAt: '2026-05-29',
    content: [
      {
        heading: 'Đối chiếu nhanh với nguồn',
        paragraphs: [
          'Mốc thời gian giúp người biên tập quay lại đúng đoạn âm thanh thay vì nghe lại toàn bộ tệp.',
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

let defaultsPromise: Promise<void> | undefined;

export const ensureCmsDefaults = () => {
  defaultsPromise ??= (async () => {
    for (const page of pages) {
      await query(
        `INSERT INTO cms_pages_v2
           (slug, title, description, eyebrow, content, metadata, status, published_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'published', now())
         ON CONFLICT (slug) DO NOTHING`,
        [
          page.slug,
          page.title,
          page.description,
          page.eyebrow,
          JSON.stringify(page.content),
          JSON.stringify(page.metadata || {}),
        ]
      );
    }

    for (const article of articles) {
      await query(
        `INSERT INTO cms_articles_v2
           (slug, title, description, category, content, status, featured,
            reading_minutes, published_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'published', $6, $7, $8::timestamptz)
         ON CONFLICT (slug) DO NOTHING`,
        [
          article.slug,
          article.title,
          article.description,
          article.category,
          JSON.stringify(article.content),
          article.featured,
          article.readingMinutes,
          article.publishedAt,
        ]
      );
    }
  })();

  return defaultsPromise;
};
