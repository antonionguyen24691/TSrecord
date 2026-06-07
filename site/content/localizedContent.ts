import { articles as vietnameseArticles, type ArticleSection, type SiteArticle } from './articles';

export const siteLocales = ['vi', 'en', 'zh', 'ko'] as const;
export type SiteLocale = (typeof siteLocales)[number];

export const normalizeSiteLocale = (value?: string | null): SiteLocale => {
  const language = String(value || '').toLowerCase().split('-')[0];
  return siteLocales.includes(language as SiteLocale) ? language as SiteLocale : 'vi';
};

export const localeNames: Record<SiteLocale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  ko: '한국어',
};

export const dateLocales: Record<SiteLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ko: 'ko-KR',
};

type InfoPageContent = {
  title: string;
  eyebrow: string;
  description: string;
  sections: ArticleSection[];
  metadata?: Record<string, unknown>;
};

export const siteCopy = {
  vi: {
    common: {
      skip: 'Đi đến nội dung',
      home: 'Trang chủ',
      articles: 'Bài viết',
      about: 'Giới thiệu',
      contact: 'Liên hệ',
      openApp: 'Mở ứng dụng',
      navLabel: 'Điều hướng chính',
      mobileNavLabel: 'Điều hướng di động',
      openMenu: 'Mở menu',
      closeMenu: 'Đóng menu',
      explore: 'Khám phá TSrecord',
      tagline: 'Từ bản ghi đến nội dung có thể sử dụng.',
      product: 'Sản phẩm',
      webApp: 'Ứng dụng web',
      guides: 'Kiến thức và hướng dẫn',
      information: 'Thông tin',
      privacy: 'Chính sách bảo mật',
      terms: 'Điều khoản sử dụng',
      footerDescription: 'Công cụ ghi âm, phiên âm và tổ chức nội dung dành cho công việc thực tế.',
      footerNote: 'Nội dung có sẵn bằng nhiều ngôn ngữ.',
      language: 'Ngôn ngữ',
      loadingApp: 'Đang mở TSrecord...',
      appTitle: 'Ứng dụng TSrecord',
      appDescription: 'Không gian làm việc phiên âm và ghi chép của TSrecord.',
    },
    landing: {
      seoTitle: 'TSrecord - Chuyển ghi âm thành văn bản và ghi chép cuộc họp',
      seoDescription: 'Ghi âm, chuyển âm thanh thành văn bản, tạo biên bản cuộc họp và quản lý nội dung trong một quy trình rõ ràng.',
      eyebrow: 'Từ bản ghi đến tài liệu có thể sử dụng',
      title: 'Nghe lại ít hơn. Nắm đúng nội dung cần làm.',
      description: 'TSrecord giúp chuyển ghi âm thành văn bản, tạo biên bản và sắp xếp nội dung theo từng phiên làm việc. Bạn kiểm soát nguồn âm, ngôn ngữ và kết quả cuối cùng.',
      start: 'Bắt đầu phiên âm',
      viewGuides: 'Xem hướng dẫn',
      trustWeb: 'Không cần cài đặt trên web',
      trustAi: 'Hỗ trợ nhiều nhà cung cấp AI',
      sceneLabel: 'Minh họa quy trình xử lý bản ghi',
      session: 'Phiên họp sản phẩm - 07/06/2026',
      processing: 'Đang xử lý',
      speaker: 'Người nói 1',
      transcript: 'Chúng ta cần thống nhất phạm vi phát hành và người phụ trách kiểm thử.',
      decision: 'Quyết định',
      decisionText: 'Phát hành bản thử nghiệm nội bộ sau khi hoàn tất kiểm tra dữ liệu.',
      audioLength: '42 phút âm thanh',
      sourceLanguage: 'Giữ ngôn ngữ gốc',
      proof: 'Dùng cho những công việc cần nghe kỹ và lưu lại có hệ thống',
      useCases: ['Cuộc họp', 'Phỏng vấn', 'Nghiên cứu', 'Nội dung số'],
      flowKicker: 'Một quy trình liền mạch',
      flowTitle: 'Không dừng lại ở một bản transcript dài.',
      flowDescription: 'Kết quả được tổ chức để bạn có thể kiểm tra, chỉnh sửa, xuất tài liệu và tiếp tục công việc mà không phải chuyển qua nhiều công cụ rời rạc.',
      features: [
        ['Đưa tệp vào hoặc ghi âm trực tiếp', 'Tiếp nhận âm thanh, video và tài liệu bổ sung trong cùng một phiên làm việc.'],
        ['Phiên âm theo mục đích', 'Chọn văn bản liền mạch hoặc mốc thời gian để phù hợp với cách sử dụng.'],
        ['Lưu theo dự án', 'Giữ bản ghi, ghi chú và kết quả đã chỉnh sửa trong một không gian làm việc.'],
      ],
      controlKicker: 'Kiểm soát và minh bạch',
      controlTitle: 'Dữ liệu công việc cần một quy trình có trách nhiệm.',
      controlDescription: 'TSrecord tách rõ ứng dụng, website nội dung và backend dịch vụ. Khóa truy cập nhạy cảm không được đưa vào nội dung công khai hoặc bài viết.',
      readPrivacy: 'Đọc chính sách bảo mật',
      controls: [
        ['Cấu hình backend riêng', 'Frontend kết nối dịch vụ qua URL môi trường, thuận tiện thay đổi hạ tầng.'],
        ['Giữ ngôn ngữ nội dung', 'Ưu tiên phiên âm đúng ngôn ngữ nói thay vì tự động dịch ngoài yêu cầu.'],
        ['Nội dung có nguồn gốc rõ', 'Bài viết hướng dẫn phục vụ người dùng, không tạo trang rỗng chỉ để đặt quảng cáo.'],
      ],
      knowledgeKicker: 'Kiến thức thực hành',
      knowledgeTitle: 'Hướng dẫn làm việc với bản ghi.',
      viewAll: 'Xem tất cả bài viết',
      readArticle: 'Đọc bài viết',
      minutesRead: 'phút đọc',
      ctaKicker: 'Bắt đầu từ tệp của bạn',
      ctaTitle: 'Biến một bản ghi thành tài liệu có thể hành động.',
      ctaButton: 'Mở TSrecord',
    },
    articles: {
      seoTitle: 'Bài viết về phiên âm, ghi âm và năng suất | TSrecord',
      seoDescription: 'Hướng dẫn chuyển ghi âm thành văn bản, ghi chép cuộc họp, bảo mật dữ liệu và tổ chức nội dung.',
      kicker: 'Thư viện TSrecord',
      title: 'Kiến thức để làm việc tốt hơn với âm thanh và văn bản.',
      description: 'Bài viết được biên soạn theo các tình huống sử dụng thực tế, có ngày cập nhật và đường dẫn riêng để dễ tìm kiếm, chia sẻ.',
      read: 'Đọc bài viết',
      minutes: 'phút đọc',
      railTitle: 'Bạn đang có một tệp cần xử lý?',
      railText: 'Mở ứng dụng để phiên âm và lưu kết quả theo dự án.',
      all: 'Tất cả bài viết',
      updated: 'Cập nhật',
      loading: 'Đang tải',
      loadingArticle: 'Đang mở bài viết...',
      missing: 'Không tìm thấy bài viết.',
      back: 'Về trang bài viết',
      applyTitle: 'Áp dụng với bản ghi của bạn',
      applyText: 'Trải nghiệm quy trình phiên âm, chỉnh sửa và lưu kết quả trong TSrecord.',
      inArticle: 'Trong bài viết',
    },
    infoUi: {
      contents: 'Nội dung',
      experience: 'Trải nghiệm TSrecord',
      contactKicker: 'Chọn đúng kênh',
      contactTitle: 'Một đầu mối rõ ràng cho từng nhu cầu.',
      supportEmail: 'Email hỗ trợ',
      region: 'Khu vực hoạt động',
      dataRequest: 'Yêu cầu dữ liệu',
    },
  },
  en: {
    common: {
      skip: 'Skip to content', home: 'Home', articles: 'Articles', about: 'About', contact: 'Contact',
      openApp: 'Open app', navLabel: 'Main navigation', mobileNavLabel: 'Mobile navigation',
      openMenu: 'Open menu', closeMenu: 'Close menu', explore: 'Explore TSrecord',
      tagline: 'Turn recordings into usable content.', product: 'Product', webApp: 'Web app',
      guides: 'Knowledge and guides', information: 'Information', privacy: 'Privacy policy',
      terms: 'Terms of use', footerDescription: 'Record, transcribe, and organize content for real work.',
      footerNote: 'Content is available in multiple languages.', language: 'Language',
      loadingApp: 'Opening TSrecord...', appTitle: 'TSrecord app',
      appDescription: 'TSrecord transcription and note-taking workspace.',
    },
    landing: {
      seoTitle: 'TSrecord - Turn recordings into text and meeting notes',
      seoDescription: 'Record, transcribe audio, create meeting notes, and organize content in one clear workflow.',
      eyebrow: 'From recordings to usable documents', title: 'Listen less. Capture what needs to happen.',
      description: 'TSrecord turns recordings into text, creates meeting notes, and organizes each work session. You stay in control of the source, language, and final output.',
      start: 'Start transcribing', viewGuides: 'View guides', trustWeb: 'No web installation required',
      trustAi: 'Supports multiple AI providers', sceneLabel: 'Recording workflow illustration',
      session: 'Product meeting - Jun 7, 2026', processing: 'Processing', speaker: 'Speaker 1',
      transcript: 'We need to confirm the release scope and the owner of quality assurance.',
      decision: 'Decision', decisionText: 'Release the internal beta after data checks are complete.',
      audioLength: '42 minutes of audio', sourceLanguage: 'Keep source language',
      proof: 'Built for work that deserves careful listening and structured records',
      useCases: ['Meetings', 'Interviews', 'Research', 'Digital content'],
      flowKicker: 'One continuous workflow', flowTitle: 'More than one long transcript.',
      flowDescription: 'Results are organized for review, editing, export, and follow-up without moving between disconnected tools.',
      features: [
        ['Upload files or record directly', 'Bring audio, video, and supporting documents into one work session.'],
        ['Transcribe for the task', 'Choose continuous text or timestamps based on how the result will be used.'],
        ['Organize by project', 'Keep recordings, notes, and edited results in one workspace.'],
      ],
      controlKicker: 'Control and transparency', controlTitle: 'Work data needs a responsible process.',
      controlDescription: 'TSrecord separates the application, content website, and service backend. Sensitive access keys never belong in public content.',
      readPrivacy: 'Read the privacy policy',
      controls: [
        ['Independent backend configuration', 'The frontend connects through environment URLs, keeping infrastructure replaceable.'],
        ['Preserve content language', 'Transcribe the language being spoken instead of translating without a request.'],
        ['Purposeful content', 'Guides are written for users, not as empty pages built around advertising.'],
      ],
      knowledgeKicker: 'Practical knowledge', knowledgeTitle: 'Guides for working with recordings.',
      viewAll: 'View all articles', readArticle: 'Read article', minutesRead: 'min read',
      ctaKicker: 'Start with your file', ctaTitle: 'Turn a recording into an actionable document.',
      ctaButton: 'Open TSrecord',
    },
    articles: {
      seoTitle: 'Transcription, recording, and productivity articles | TSrecord',
      seoDescription: 'Guides to transcription, meeting notes, data privacy, and content organization.',
      kicker: 'TSrecord library', title: 'Knowledge for better work with audio and text.',
      description: 'Practical articles with clear update dates and permanent links for sharing and search.',
      read: 'Read article', minutes: 'min read', railTitle: 'Have a file to process?',
      railText: 'Open the app to transcribe it and save the result by project.', all: 'All articles',
      updated: 'Updated', loading: 'Loading', loadingArticle: 'Opening article...',
      missing: 'Article not found.', back: 'Back to articles', applyTitle: 'Use this with your recording',
      applyText: 'Try the transcription, editing, and project workflow in TSrecord.', inArticle: 'In this article',
    },
    infoUi: {
      contents: 'Contents', experience: 'Try TSrecord', contactKicker: 'Choose the right channel',
      contactTitle: 'A clear point of contact for every need.', supportEmail: 'Support email',
      region: 'Service region', dataRequest: 'Data requests',
    },
  },
  zh: {
    common: {
      skip: '跳到主要内容', home: '首页', articles: '文章', about: '关于我们', contact: '联系我们',
      openApp: '打开应用', navLabel: '主导航', mobileNavLabel: '移动端导航', openMenu: '打开菜单',
      closeMenu: '关闭菜单', explore: '探索 TSrecord', tagline: '将录音转化为可用内容。',
      product: '产品', webApp: '网页应用', guides: '知识与指南', information: '信息',
      privacy: '隐私政策', terms: '使用条款', footerDescription: '面向实际工作的录音、转写与内容整理工具。',
      footerNote: '内容提供多种语言版本。', language: '语言', loadingApp: '正在打开 TSrecord...',
      appTitle: 'TSrecord 应用', appDescription: 'TSrecord 转写与笔记工作区。',
    },
    landing: {
      seoTitle: 'TSrecord - 将录音转成文字和会议纪要',
      seoDescription: '在一个清晰流程中完成录音、音频转写、会议纪要和内容管理。',
      eyebrow: '从录音到可用文档', title: '少听回放，准确掌握下一步。',
      description: 'TSrecord 将录音转成文字、生成会议纪要，并按工作会话整理内容。音频来源、语言和最终结果都由您控制。',
      start: '开始转写', viewGuides: '查看指南', trustWeb: '网页端无需安装',
      trustAi: '支持多个 AI 服务商', sceneLabel: '录音处理流程示意图',
      session: '产品会议 - 2026/06/07', processing: '处理中', speaker: '发言人 1',
      transcript: '我们需要确认发布范围和测试负责人。', decision: '决定',
      decisionText: '数据检查完成后发布内部测试版。', audioLength: '42 分钟音频',
      sourceLanguage: '保留原始语言', proof: '适合需要认真倾听和系统记录的工作',
      useCases: ['会议', '访谈', '研究', '数字内容'],
      flowKicker: '连贯的一体化流程', flowTitle: '不止是一份冗长的转写稿。',
      flowDescription: '结果经过整理，便于核对、编辑、导出和继续工作，无需在多个零散工具之间切换。',
      features: [
        ['上传文件或直接录音', '在同一工作会话中接收音频、视频和补充文档。'],
        ['按用途转写', '根据使用方式选择连续文本或时间戳。'],
        ['按项目保存', '在一个工作区中保存录音、笔记和编辑结果。'],
      ],
      controlKicker: '控制与透明', controlTitle: '工作数据需要负责任的处理流程。',
      controlDescription: 'TSrecord 将应用、内容网站和服务后端明确分离。敏感访问密钥不会出现在公开内容中。',
      readPrivacy: '阅读隐私政策',
      controls: [
        ['独立后端配置', '前端通过环境 URL 连接服务，便于调整基础设施。'],
        ['保留内容语言', '优先转写实际口语，不在未经要求时自动翻译。'],
        ['内容来源清晰', '指南面向真实用户，而不是为广告创建空页面。'],
      ],
      knowledgeKicker: '实用知识', knowledgeTitle: '录音工作指南。', viewAll: '查看所有文章',
      readArticle: '阅读文章', minutesRead: '分钟阅读', ctaKicker: '从您的文件开始',
      ctaTitle: '将一段录音变成可执行的文档。', ctaButton: '打开 TSrecord',
    },
    articles: {
      seoTitle: '转写、录音与效率文章 | TSrecord', seoDescription: '关于音频转写、会议纪要、数据安全和内容整理的指南。',
      kicker: 'TSrecord 资料库', title: '帮助您更好处理音频和文字的知识。',
      description: '文章来自实际使用场景，标注更新时间，并提供便于搜索和分享的固定链接。',
      read: '阅读文章', minutes: '分钟阅读', railTitle: '有文件需要处理？',
      railText: '打开应用进行转写，并按项目保存结果。', all: '所有文章', updated: '更新于',
      loading: '加载中', loadingArticle: '正在打开文章...', missing: '未找到文章。',
      back: '返回文章列表', applyTitle: '用于您的录音', applyText: '在 TSrecord 中体验转写、编辑和保存流程。',
      inArticle: '本文内容',
    },
    infoUi: {
      contents: '目录', experience: '体验 TSrecord', contactKicker: '选择合适的渠道',
      contactTitle: '为每种需求提供明确的联系入口。', supportEmail: '支持邮箱',
      region: '服务地区', dataRequest: '数据请求',
    },
  },
  ko: {
    common: {
      skip: '본문으로 이동', home: '홈', articles: '글', about: '소개', contact: '문의',
      openApp: '앱 열기', navLabel: '주요 탐색', mobileNavLabel: '모바일 탐색', openMenu: '메뉴 열기',
      closeMenu: '메뉴 닫기', explore: 'TSrecord 살펴보기', tagline: '녹음을 활용 가능한 콘텐츠로 바꾸세요.',
      product: '제품', webApp: '웹 앱', guides: '지식과 가이드', information: '정보',
      privacy: '개인정보 처리방침', terms: '이용약관', footerDescription: '실무를 위한 녹음, 전사, 콘텐츠 정리 도구입니다.',
      footerNote: '콘텐츠는 여러 언어로 제공됩니다.', language: '언어', loadingApp: 'TSrecord를 여는 중...',
      appTitle: 'TSrecord 앱', appDescription: 'TSrecord 전사 및 노트 작업 공간입니다.',
    },
    landing: {
      seoTitle: 'TSrecord - 녹음을 텍스트와 회의록으로',
      seoDescription: '하나의 명확한 흐름에서 녹음, 음성 전사, 회의록 작성, 콘텐츠 관리를 수행하세요.',
      eyebrow: '녹음에서 활용 가능한 문서까지', title: '다시 듣는 시간은 줄이고, 해야 할 일은 정확히.',
      description: 'TSrecord는 녹음을 텍스트로 변환하고 회의록을 만들며 작업 세션별로 내용을 정리합니다. 음원, 언어, 최종 결과를 직접 관리할 수 있습니다.',
      start: '전사 시작', viewGuides: '가이드 보기', trustWeb: '웹에서 설치 없이 사용',
      trustAi: '여러 AI 제공업체 지원', sceneLabel: '녹음 처리 흐름 예시',
      session: '제품 회의 - 2026. 06. 07.', processing: '처리 중', speaker: '발언자 1',
      transcript: '출시 범위와 품질 검증 담당자를 확정해야 합니다.', decision: '결정',
      decisionText: '데이터 검사가 끝나면 내부 베타를 출시합니다.', audioLength: '42분 오디오',
      sourceLanguage: '원본 언어 유지', proof: '세심한 청취와 체계적인 기록이 필요한 업무를 위해',
      useCases: ['회의', '인터뷰', '연구', '디지털 콘텐츠'],
      flowKicker: '끊김 없는 하나의 흐름', flowTitle: '긴 전사문에서 끝나지 않습니다.',
      flowDescription: '여러 도구를 오가지 않고 검토, 편집, 내보내기, 후속 작업까지 이어갈 수 있도록 결과를 정리합니다.',
      features: [
        ['파일 업로드 또는 직접 녹음', '오디오, 비디오, 참고 문서를 하나의 작업 세션에서 관리합니다.'],
        ['목적에 맞는 전사', '사용 방식에 따라 연속 텍스트 또는 타임스탬프를 선택합니다.'],
        ['프로젝트별 저장', '녹음, 노트, 편집 결과를 하나의 작업 공간에 보관합니다.'],
      ],
      controlKicker: '통제와 투명성', controlTitle: '업무 데이터에는 책임 있는 처리 과정이 필요합니다.',
      controlDescription: 'TSrecord는 앱, 콘텐츠 웹사이트, 서비스 백엔드를 분리합니다. 민감한 접근 키는 공개 콘텐츠에 포함되지 않습니다.',
      readPrivacy: '개인정보 처리방침 읽기',
      controls: [
        ['독립적인 백엔드 구성', '프런트엔드는 환경 URL로 서비스에 연결되어 인프라 변경이 쉽습니다.'],
        ['콘텐츠 언어 유지', '요청하지 않은 자동 번역 대신 실제 발화 언어를 우선 전사합니다.'],
        ['목적이 분명한 콘텐츠', '가이드는 광고용 빈 페이지가 아니라 사용자를 위해 작성됩니다.'],
      ],
      knowledgeKicker: '실용 지식', knowledgeTitle: '녹음 작업을 위한 가이드.', viewAll: '모든 글 보기',
      readArticle: '글 읽기', minutesRead: '분', ctaKicker: '내 파일에서 시작',
      ctaTitle: '녹음을 실행 가능한 문서로 바꾸세요.', ctaButton: 'TSrecord 열기',
    },
    articles: {
      seoTitle: '전사, 녹음, 생산성 글 | TSrecord', seoDescription: '음성 전사, 회의록, 데이터 보안, 콘텐츠 정리에 관한 가이드입니다.',
      kicker: 'TSrecord 라이브러리', title: '오디오와 텍스트로 더 잘 일하기 위한 지식.',
      description: '실제 사용 상황을 바탕으로 작성하고 업데이트 날짜와 공유 가능한 고정 링크를 제공합니다.',
      read: '글 읽기', minutes: '분', railTitle: '처리할 파일이 있나요?',
      railText: '앱에서 전사하고 프로젝트별로 결과를 저장하세요.', all: '모든 글', updated: '업데이트',
      loading: '불러오는 중', loadingArticle: '글을 여는 중...', missing: '글을 찾을 수 없습니다.',
      back: '글 목록으로', applyTitle: '내 녹음에 적용하기', applyText: 'TSrecord에서 전사, 편집, 저장 흐름을 경험하세요.',
      inArticle: '이 글의 내용',
    },
    infoUi: {
      contents: '목차', experience: 'TSrecord 체험하기', contactKicker: '알맞은 채널 선택',
      contactTitle: '필요에 맞는 명확한 문의 창구.', supportEmail: '지원 이메일',
      region: '서비스 지역', dataRequest: '데이터 요청',
    },
  },
} as const;

const translatedArticles: Record<Exclude<SiteLocale, 'vi'>, SiteArticle[]> = {
  en: [
    {
      slug: 'chuyen-ghi-am-thanh-van-ban-chinh-xac', title: 'How to turn recordings into clear, reviewable text',
      description: 'Prepare audio, choose a transcription format, and review the result with less editing time.',
      category: 'Guide', publishedAt: '2026-06-07', updatedAt: '2026-06-07', readingMinutes: 6, featured: true,
      sections: [
        { heading: 'Start with the audio source', paragraphs: ['Even strong speech recognition needs clear input. Place the device near speakers, reduce steady background noise, and avoid overlapping voices.'] },
        { heading: 'Choose the right output', paragraphs: ['Use timestamps for source verification and continuous text for documents intended to be read.'], bullets: ['Keep the source language for specialist terms.', 'Use meeting context for decisions and action items.', 'Use interview context to separate questions and answers.'] },
        { heading: 'Review names and numbers', paragraphs: ['Check people, product names, amounts, and dates against the recording before publishing or sharing the result.'] },
      ],
    },
    {
      slug: 'ghi-chep-cuoc-hop-bang-ai', title: 'AI meeting notes: what should be automated?',
      description: 'Separate work AI can prepare from decisions that still need a responsible person.',
      category: 'Productivity', publishedAt: '2026-06-05', updatedAt: '2026-06-07', readingMinutes: 5,
      sections: [
        { heading: 'Automate capture', paragraphs: ['Transcription, topic grouping, and draft action items can be standardized so participants can focus on the discussion.'] },
        { heading: 'Do not automate accountability', paragraphs: ['The chair should still confirm final decisions, owners, and deadlines.'], bullets: ['Send notes soon after the meeting.', 'Mark unresolved points instead of guessing.', 'Store the recording and notes in the same project.'] },
      ],
    },
    {
      slug: 'bao-mat-du-lieu-ghi-am', title: 'Protecting recording data when using AI services',
      description: 'Questions to ask about access, API keys, retention, and sensitive data.',
      category: 'Security', publishedAt: '2026-06-02', updatedAt: '2026-06-07', readingMinutes: 7,
      sections: [
        { heading: 'Classify data before upload', paragraphs: ['Identify customer information, internal material, and content covered by confidentiality agreements before processing.'] },
        { heading: 'Manage access keys', paragraphs: ['Never place API keys in public source code or shared documents. Use secure operating-system storage on personal devices.'] },
        { heading: 'Define retention and deletion', paragraphs: ['Set retention periods, access roles, and a clear response process for deletion requests.'] },
      ],
    },
    {
      slug: 'so-sanh-phien-am-co-moc-thoi-gian', title: 'When should a transcript include timestamps?',
      description: 'Use timestamps to verify claims, edit video, and quote recordings precisely.',
      category: 'Knowledge', publishedAt: '2026-05-29', updatedAt: '2026-06-07', readingMinutes: 4,
      sections: [
        { heading: 'Return to the source quickly', paragraphs: ['Timestamps take an editor directly to the relevant audio instead of forcing a replay of the entire file.'] },
        { heading: 'Create subtitles and clips', paragraphs: ['For video production, timestamps provide the basis for subtitles, excerpts, and highlight markers.'] },
      ],
    },
  ],
  zh: [
    {
      slug: 'chuyen-ghi-am-thanh-van-ban-chinh-xac', title: '如何将录音转成清晰、易核对的文字',
      description: '通过准备音频、选择转写形式和检查结果来减少编辑时间。',
      category: '指南', publishedAt: '2026-06-07', updatedAt: '2026-06-07', readingMinutes: 6, featured: true,
      sections: [
        { heading: '从音源质量开始', paragraphs: ['再好的语音识别也需要清晰输入。请让设备靠近发言人，减少持续噪音，并避免多人同时说话。'] },
        { heading: '选择合适的结果形式', paragraphs: ['需要核对原视频、会议或访谈时使用时间戳；需要编辑成可读文档时使用连续文本。'], bullets: ['专业术语较多时保留原始语言。', '会议场景应关注决定和行动项。', '访谈场景应区分问题和回答。'] },
        { heading: '务必核对专有名词和数字', paragraphs: ['姓名、产品名、金额和日期应与原始录音再次核对。'] },
      ],
    },
    {
      slug: 'ghi-chep-cuoc-hop-bang-ai', title: 'AI 会议记录：哪些部分适合自动化？',
      description: '区分可以交给 AI 的工作，以及仍需负责人确认的内容。',
      category: '效率', publishedAt: '2026-06-05', updatedAt: '2026-06-07', readingMinutes: 5,
      sections: [
        { heading: '自动完成记录工作', paragraphs: ['转写、主题归类和行动项草稿可以标准化，让参与者专注于讨论。'] },
        { heading: '责任不能自动化', paragraphs: ['主持人仍需确认最终决定、负责人和截止日期。'], bullets: ['会后尽快发送纪要。', '标记未达成一致的内容，不要自行推断。', '将录音和纪要保存在同一项目中。'] },
      ],
    },
    {
      slug: 'bao-mat-du-lieu-ghi-am', title: '使用 AI 服务时如何保护录音数据',
      description: '需要检查访问权限、API 密钥、保留时间和敏感数据。',
      category: '安全', publishedAt: '2026-06-02', updatedAt: '2026-06-07', readingMinutes: 7,
      sections: [
        { heading: '上传前先分类数据', paragraphs: ['处理前识别客户信息、内部资料以及受保密协议约束的内容。'] },
        { heading: '管理访问密钥', paragraphs: ['不要在公开代码或共享文档中放置 API 密钥，个人设备应使用系统安全存储。'] },
        { heading: '制定保留和删除流程', paragraphs: ['明确录音保留期限、访问角色和删除请求的处理方式。'] },
      ],
    },
    {
      slug: 'so-sanh-phien-am-co-moc-thoi-gian', title: '什么时候应该使用带时间戳的转写？',
      description: '时间戳有助于内容核验、视频剪辑和精确引用。',
      category: '知识', publishedAt: '2026-05-29', updatedAt: '2026-06-07', readingMinutes: 4,
      sections: [
        { heading: '快速返回原始内容', paragraphs: ['时间戳让编辑者直接回到相关音频片段，无需重听整个文件。'] },
        { heading: '制作字幕和短内容', paragraphs: ['在视频制作中，时间戳是字幕、片段选择和重点标记的基础。'] },
      ],
    },
  ],
  ko: [
    {
      slug: 'chuyen-ghi-am-thanh-van-ban-chinh-xac', title: '녹음을 명확하고 검토하기 쉬운 텍스트로 바꾸는 방법',
      description: '오디오 준비, 전사 형식 선택, 결과 검토를 통해 편집 시간을 줄입니다.',
      category: '가이드', publishedAt: '2026-06-07', updatedAt: '2026-06-07', readingMinutes: 6, featured: true,
      sections: [
        { heading: '음원 품질에서 시작하세요', paragraphs: ['성능이 좋은 음성 인식도 선명한 입력이 필요합니다. 기기를 발언자 가까이에 두고 지속적인 소음을 줄이며 겹쳐 말하지 않도록 하세요.'] },
        { heading: '알맞은 결과 형식을 선택하세요', paragraphs: ['원본 확인에는 타임스탬프가, 읽기 문서 편집에는 연속 텍스트가 적합합니다.'], bullets: ['전문 용어가 많다면 원본 언어를 유지하세요.', '회의에서는 결정과 할 일을 중심으로 처리하세요.', '인터뷰에서는 질문과 답변을 구분하세요.'] },
        { heading: '이름과 수치를 확인하세요', paragraphs: ['사람 이름, 제품명, 금액, 날짜는 공유 전에 원본 녹음과 다시 대조해야 합니다.'] },
      ],
    },
    {
      slug: 'ghi-chep-cuoc-hop-bang-ai', title: 'AI 회의록, 어디까지 자동화해야 할까요?',
      description: 'AI가 준비할 수 있는 작업과 담당자가 확인해야 하는 결정을 구분합니다.',
      category: '생산성', publishedAt: '2026-06-05', updatedAt: '2026-06-07', readingMinutes: 5,
      sections: [
        { heading: '기록 작업 자동화', paragraphs: ['전사, 주제 분류, 할 일 초안은 표준화할 수 있어 참석자가 대화에 집중할 수 있습니다.'] },
        { heading: '책임은 자동화하지 마세요', paragraphs: ['최종 결정, 담당자, 마감일은 회의 진행자가 확인해야 합니다.'], bullets: ['회의 후 빠르게 회의록을 공유하세요.', '합의되지 않은 내용은 추측하지 말고 표시하세요.', '녹음과 회의록을 같은 프로젝트에 저장하세요.'] },
      ],
    },
    {
      slug: 'bao-mat-du-lieu-ghi-am', title: 'AI 서비스에서 녹음 데이터를 보호하는 방법',
      description: '접근 권한, API 키, 보관 기간, 민감한 데이터를 점검합니다.',
      category: '보안', publishedAt: '2026-06-02', updatedAt: '2026-06-07', readingMinutes: 7,
      sections: [
        { heading: '업로드 전에 데이터를 분류하세요', paragraphs: ['처리 전에 고객 정보, 내부 자료, 기밀 유지 계약이 적용되는 콘텐츠인지 확인하세요.'] },
        { heading: '접근 키 관리', paragraphs: ['API 키를 공개 코드나 공유 문서에 넣지 말고 개인 기기에서는 운영체제의 보안 저장소를 사용하세요.'] },
        { heading: '보관 및 삭제 절차 설정', paragraphs: ['녹음 보관 기간, 접근 역할, 삭제 요청 처리 방법을 명확히 정하세요.'] },
      ],
    },
    {
      slug: 'so-sanh-phien-am-co-moc-thoi-gian', title: '언제 타임스탬프 전사를 사용해야 할까요?',
      description: '내용 검증, 영상 편집, 정확한 인용에 타임스탬프를 활용합니다.',
      category: '지식', publishedAt: '2026-05-29', updatedAt: '2026-06-07', readingMinutes: 4,
      sections: [
        { heading: '원본을 빠르게 확인하기', paragraphs: ['타임스탬프를 사용하면 파일 전체를 다시 듣지 않고 관련 오디오 구간으로 바로 이동할 수 있습니다.'] },
        { heading: '자막과 짧은 콘텐츠 만들기', paragraphs: ['영상 제작에서 타임스탬프는 자막, 클립 선택, 하이라이트 표시의 기준이 됩니다.'] },
      ],
    },
  ],
};

export const getArticlesForLocale = (locale: SiteLocale): SiteArticle[] =>
  locale === 'vi' ? vietnameseArticles : translatedArticles[locale];

export const getArticleForLocale = (slug: string, locale: SiteLocale) =>
  getArticlesForLocale(locale).find((article) => article.slug === slug);

const infoPages: Record<SiteLocale, Record<string, InfoPageContent>> = {
  vi: {
    'gioi-thieu': {
      title: 'Giới thiệu', eyebrow: 'Về TSrecord',
      description: 'TSrecord được xây dựng để giảm thời gian nghe lại và giúp nội dung từ bản ghi đi tiếp vào công việc.',
      sections: [
        { heading: 'Từ âm thanh rời rạc đến tri thức có thể sử dụng', paragraphs: ['TSrecord tập trung vào một quy trình rõ ràng: tiếp nhận bản ghi, tạo văn bản, kiểm tra kết quả và lưu lại theo dự án.'] },
        { heading: 'Nguyên tắc phát triển', paragraphs: ['Minh bạch, tôn trọng ngôn ngữ gốc và để người dùng kiểm soát kết quả.'], bullets: ['Nội dung được xử lý đúng mục đích.', 'Không tự ý dịch bản ghi.', 'Frontend và backend được tách rõ.'] },
      ],
    },
    'lien-he': {
      title: 'Liên hệ', eyebrow: 'Kết nối với đội ngũ',
      description: 'Kênh tiếp nhận câu hỏi về sản phẩm, dữ liệu, hợp tác nội dung và quảng cáo.',
      metadata: { email: 'support@tsrecord.vn', region: 'Phục vụ trực tuyến tại Việt Nam và các thị trường được hỗ trợ.' },
      sections: [
        { heading: 'Hỗ trợ sản phẩm', paragraphs: ['Gửi mô tả thiết bị, phiên bản và thao tác gây lỗi để đội ngũ kiểm tra.'] },
        { heading: 'Yêu cầu dữ liệu', paragraphs: ['Ghi rõ “Yêu cầu dữ liệu” trong tiêu đề email để được phân loại đúng.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: 'Chính sách bảo mật', eyebrow: 'Minh bạch dữ liệu',
      description: 'Thông tin về dữ liệu được xử lý, mục đích sử dụng, lưu trữ và công nghệ quảng cáo.',
      sections: [
        { heading: 'Thông tin được xử lý', paragraphs: ['TSrecord chỉ xử lý dữ liệu cần thiết để cung cấp các tính năng được yêu cầu.'] },
        { heading: 'Quyền của người dùng', paragraphs: ['Người dùng có thể yêu cầu giải thích, chỉnh sửa hoặc xóa dữ liệu phù hợp.'] },
      ],
    },
    'dieu-khoan': {
      title: 'Điều khoản sử dụng', eyebrow: 'Quy tắc sử dụng',
      description: 'Các nguyên tắc cơ bản khi sử dụng website, ứng dụng và nội dung của TSrecord.',
      sections: [
        { heading: 'Phạm vi dịch vụ', paragraphs: ['Kết quả do AI tạo ra cần được người dùng kiểm tra trước khi sử dụng.'] },
        { heading: 'Trách nhiệm nội dung', paragraphs: ['Người dùng phải có quyền xử lý các tệp được tải lên.'] },
      ],
    },
  },
  en: {
    'gioi-thieu': {
      title: 'About', eyebrow: 'About TSrecord',
      description: 'TSrecord reduces replay time and helps recording content move into real work.',
      sections: [
        { heading: 'From fragmented audio to usable knowledge', paragraphs: ['TSrecord follows a clear process: receive a recording, create text, review the result, and keep it with the project.'] },
        { heading: 'Product principles', paragraphs: ['Be transparent, respect the source language, and keep users in control.'], bullets: ['Process content for its stated purpose.', 'Never translate recordings without a request.', 'Keep frontend and backend responsibilities separate.'] },
      ],
    },
    'lien-he': {
      title: 'Contact', eyebrow: 'Connect with the team',
      description: 'Contact us about the product, data, content partnerships, and advertising.',
      metadata: { email: 'support@tsrecord.vn', region: 'Online service for Vietnam and supported markets.' },
      sections: [
        { heading: 'Product support', paragraphs: ['Include your device, version, and the steps that caused the issue so the team can investigate.'] },
        { heading: 'Data requests', paragraphs: ['Include “Data request” in the email subject so it reaches the right workflow.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: 'Privacy policy', eyebrow: 'Data transparency',
      description: 'How data is processed, why it is used, how it is stored, and how advertising technology is handled.',
      sections: [
        { heading: 'Information we process', paragraphs: ['TSrecord only processes data needed to provide requested features.'] },
        { heading: 'Your rights', paragraphs: ['Users can request an explanation, correction, or deletion where applicable.'] },
      ],
    },
    'dieu-khoan': {
      title: 'Terms of use', eyebrow: 'Usage rules',
      description: 'Core principles for using the TSrecord website, app, and content.',
      sections: [
        { heading: 'Service scope', paragraphs: ['AI-generated results must be reviewed before they are used.'] },
        { heading: 'Content responsibility', paragraphs: ['Users must have the right to process every uploaded file.'] },
      ],
    },
  },
  zh: {
    'gioi-thieu': {
      title: '关于我们', eyebrow: '关于 TSrecord', description: 'TSrecord 旨在减少重复收听时间，让录音内容真正进入工作流程。',
      sections: [
        { heading: '从零散音频到可用知识', paragraphs: ['TSrecord 专注于清晰流程：接收录音、生成文字、检查结果并按项目保存。'] },
        { heading: '产品原则', paragraphs: ['保持透明，尊重原始语言，并让用户控制最终结果。'], bullets: ['按明确目的处理内容。', '未经要求不自动翻译录音。', '明确分离前端与后端职责。'] },
      ],
    },
    'lien-he': {
      title: '联系我们', eyebrow: '与团队联系', description: '咨询产品、数据、内容合作和广告相关问题。',
      metadata: { email: 'support@tsrecord.vn', region: '在线服务覆盖越南及其他受支持市场。' },
      sections: [
        { heading: '产品支持', paragraphs: ['请提供设备、版本和复现步骤，便于团队检查问题。'] },
        { heading: '数据请求', paragraphs: ['请在邮件主题中注明“数据请求”，以便正确分类。'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: '隐私政策', eyebrow: '数据透明', description: '说明数据处理、使用目的、存储方式和广告技术。',
      sections: [
        { heading: '我们处理的信息', paragraphs: ['TSrecord 只处理提供所请求功能所必需的数据。'] },
        { heading: '用户权利', paragraphs: ['用户可以在适用情况下要求说明、更正或删除数据。'] },
      ],
    },
    'dieu-khoan': {
      title: '使用条款', eyebrow: '使用规则', description: '使用 TSrecord 网站、应用和内容时应遵守的基本原则。',
      sections: [
        { heading: '服务范围', paragraphs: ['使用 AI 生成的结果前，用户必须进行检查。'] },
        { heading: '内容责任', paragraphs: ['用户必须拥有处理所上传文件的权利。'] },
      ],
    },
  },
  ko: {
    'gioi-thieu': {
      title: '소개', eyebrow: 'TSrecord 소개', description: 'TSrecord는 다시 듣는 시간을 줄이고 녹음 콘텐츠가 실제 업무로 이어지도록 설계되었습니다.',
      sections: [
        { heading: '분산된 오디오에서 활용 가능한 지식으로', paragraphs: ['TSrecord는 녹음 수집, 텍스트 생성, 결과 검토, 프로젝트별 저장이라는 명확한 흐름에 집중합니다.'] },
        { heading: '제품 원칙', paragraphs: ['투명성을 지키고 원본 언어를 존중하며 사용자가 결과를 관리하도록 합니다.'], bullets: ['명시된 목적에 맞게 콘텐츠를 처리합니다.', '요청 없이 녹음을 번역하지 않습니다.', '프런트엔드와 백엔드 책임을 분리합니다.'] },
      ],
    },
    'lien-he': {
      title: '문의', eyebrow: '팀에 문의하기', description: '제품, 데이터, 콘텐츠 제휴, 광고에 관한 문의를 받습니다.',
      metadata: { email: 'support@tsrecord.vn', region: '베트남과 지원되는 시장에 온라인으로 서비스를 제공합니다.' },
      sections: [
        { heading: '제품 지원', paragraphs: ['팀이 확인할 수 있도록 기기, 버전, 오류가 발생한 단계를 알려 주세요.'] },
        { heading: '데이터 요청', paragraphs: ['정확히 분류되도록 이메일 제목에 “데이터 요청”을 적어 주세요.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: '개인정보 처리방침', eyebrow: '데이터 투명성', description: '처리하는 데이터, 사용 목적, 보관 방식, 광고 기술에 관한 안내입니다.',
      sections: [
        { heading: '처리하는 정보', paragraphs: ['TSrecord는 요청된 기능을 제공하는 데 필요한 데이터만 처리합니다.'] },
        { heading: '사용자의 권리', paragraphs: ['사용자는 해당되는 경우 설명, 수정, 삭제를 요청할 수 있습니다.'] },
      ],
    },
    'dieu-khoan': {
      title: '이용약관', eyebrow: '이용 규칙', description: 'TSrecord 웹사이트, 앱, 콘텐츠 이용에 관한 기본 원칙입니다.',
      sections: [
        { heading: '서비스 범위', paragraphs: ['AI가 생성한 결과는 사용 전에 반드시 검토해야 합니다.'] },
        { heading: '콘텐츠 책임', paragraphs: ['사용자는 업로드하는 모든 파일을 처리할 권한이 있어야 합니다.'] },
      ],
    },
  },
};

export const getInfoPageForLocale = (slug: string, locale: SiteLocale) =>
  infoPages[locale][slug] || infoPages.vi[slug];
