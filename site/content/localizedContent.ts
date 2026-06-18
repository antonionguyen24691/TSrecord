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
      pricing: 'Bảng giá',
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
      download: 'Tải ứng dụng',
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
      pricing: 'Pricing',
      openApp: 'Open app', navLabel: 'Main navigation', mobileNavLabel: 'Mobile navigation',
      openMenu: 'Open menu', closeMenu: 'Close menu', explore: 'Explore TSrecord',
      tagline: 'Turn recordings into usable content.', product: 'Product', webApp: 'Web app',
      guides: 'Knowledge and guides', information: 'Information', privacy: 'Privacy policy',
      terms: 'Terms of use', download: 'Download', footerDescription: 'Record, transcribe, and organize content for real work.',
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
      pricing: '价格',
      openApp: '打开应用', navLabel: '主导航', mobileNavLabel: '移动端导航', openMenu: '打开菜单',
      closeMenu: '关闭菜单', explore: '探索 TSrecord', tagline: '将录音转化为可用内容。',
      product: '产品', webApp: '网页应用', guides: '知识与指南', information: '信息',
      privacy: '隐私政策', terms: '使用条款', download: '下载应用', footerDescription: '面向实际工作的录音、转写与内容整理工具。',
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
      pricing: '요금',
      openApp: '앱 열기', navLabel: '주요 탐색', mobileNavLabel: '모바일 탐색', openMenu: '메뉴 열기',
      closeMenu: '메뉴 닫기', explore: 'TSrecord 살펴보기', tagline: '녹음을 활용 가능한 콘텐츠로 바꾸세요.',
      product: '제품', webApp: '웹 앱', guides: '지식과 가이드', information: '정보',
      privacy: '개인정보 처리방침', terms: '이용약관', download: '앱 다운로드', footerDescription: '실무를 위한 녹음, 전사, 콘텐츠 정리 도구입니다.',
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
      description: 'TSrecord là công cụ ghi âm, chuyển giọng nói thành văn bản và tổ chức nội dung dành cho công việc thực tế — giúp bạn nghe lại ít hơn và nắm đúng những gì cần làm.',
      sections: [
        { heading: 'TSrecord là gì', paragraphs: ['TSrecord giúp biến một bản ghi âm hoặc tệp âm thanh, video thành văn bản rõ ràng, biên bản cuộc họp và các tài liệu có thể sử dụng ngay. Thay vì mất hàng giờ tua đi tua lại, bạn có một quy trình liền mạch: đưa âm thanh vào, phiên âm, kiểm tra kết quả và lưu lại theo dự án.', 'Sản phẩm có mặt trên web (không cần cài đặt) và trên ứng dụng di động Android, iOS, dùng chung một không gian làm việc.'] },
        { heading: 'Ba không gian làm việc', paragraphs: ['TSrecord được chia thành ba phần để phục vụ từng nhu cầu khác nhau nhưng vẫn nằm trong một quy trình thống nhất:'], bullets: ['Phiên âm: đưa tệp âm thanh/video vào hoặc ghi trực tiếp, chọn văn bản liền mạch hoặc có mốc thời gian.', 'Ghi âm & ghi chú: vừa ghi âm vừa lưu ghi chú, sắp xếp theo phiên làm việc.', 'Chỉnh sửa âm thanh: cắt, ghép và xử lý bản ghi trước khi phiên âm.'] },
        { heading: 'Từ bản ghi đến tài liệu có thể hành động', paragraphs: ['Kết quả không dừng lại ở một bản transcript dài. Tùy theo bối cảnh (phiên âm thường, cuộc họp hay phỏng vấn), TSrecord có thể tạo bản tóm tắt, danh sách việc cần làm, các quyết định, rủi ro và sơ đồ nội dung — tất cả được tổ chức để bạn kiểm tra, chỉnh sửa và xuất ra DOCX/PPTX.'] },
        { heading: 'Dành cho ai', paragraphs: ['TSrecord phù hợp với những công việc cần nghe kỹ và lưu lại có hệ thống: ghi biên bản cuộc họp, gỡ băng phỏng vấn, nghiên cứu định tính, sản xuất nội dung số, học tập và làm việc cá nhân.'] },
        { heading: 'Nguyên tắc phát triển', paragraphs: ['Chúng tôi xây dựng TSrecord theo hướng minh bạch, tôn trọng ngôn ngữ gốc của bản ghi và để người dùng kiểm soát kết quả cuối cùng.'], bullets: ['Nội dung được xử lý đúng mục đích bạn yêu cầu.', 'Không tự ý dịch bản ghi khi bạn không yêu cầu.', 'Ứng dụng, website nội dung và backend dịch vụ được tách rõ.', 'Khóa truy cập nhạy cảm không bao giờ được đưa vào nội dung công khai.'] },
        { heading: 'Linh hoạt về AI và mô hình freemium', paragraphs: ['TSrecord hỗ trợ nhiều nhà cung cấp AI để bạn lựa chọn theo nhu cầu và chi phí. Sản phẩm hoạt động theo mô hình freemium: dùng được các tính năng cơ bản miễn phí và nâng cấp khi cần xử lý nhiều hơn, thanh toán qua SePay hoặc Stripe.'] },
      ],
    },
    'lien-he': {
      title: 'Liên hệ', eyebrow: 'Kết nối với đội ngũ',
      description: 'Kênh tiếp nhận câu hỏi về sản phẩm, dữ liệu, thanh toán, hợp tác nội dung và quảng cáo.',
      metadata: { email: 'support@tsrecord.vn', region: 'Phục vụ trực tuyến tại Việt Nam và các thị trường được hỗ trợ.' },
      sections: [
        { heading: 'Hỗ trợ sản phẩm', paragraphs: ['Khi gặp lỗi hoặc cần trợ giúp, hãy gửi email kèm mô tả thiết bị, hệ điều hành, phiên bản ứng dụng và các thao tác dẫn đến lỗi để đội ngũ kiểm tra nhanh hơn. Nếu có thể, đính kèm ảnh chụp màn hình.'] },
        { heading: 'Yêu cầu dữ liệu', paragraphs: ['Để truy xuất, chỉnh sửa hoặc xóa dữ liệu liên quan đến bạn, hãy ghi rõ “Yêu cầu dữ liệu” trong tiêu đề email và dùng đúng địa chỉ email gắn với tài khoản để chúng tôi xác minh.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: 'Chính sách bảo mật', eyebrow: 'Minh bạch dữ liệu',
      description: 'Chính sách này giải thích TSrecord xử lý dữ liệu nào, vì mục đích gì, lưu trữ ra sao và bạn có những quyền gì. Cập nhật lần gần nhất: 14/06/2026.',
      sections: [
        { heading: 'Phạm vi áp dụng', paragraphs: ['Chính sách áp dụng cho website TSrecord (tsrecord.vn), ứng dụng web tại /app và ứng dụng di động Android, iOS. Khi sử dụng dịch vụ, bạn đồng ý với cách xử lý dữ liệu được mô tả ở đây.'] },
        { heading: 'Thông tin chúng tôi xử lý', paragraphs: ['Chúng tôi chỉ xử lý dữ liệu cần thiết để cung cấp tính năng bạn yêu cầu:'], bullets: ['Thông tin tài khoản: email và thông tin đăng nhập, gói dịch vụ.', 'Nội dung bạn đưa vào: tệp âm thanh, video, bản ghi và văn bản phiên âm.', 'Dữ liệu kỹ thuật: loại thiết bị, hệ điều hành, phiên bản ứng dụng và nhật ký lỗi cơ bản.', 'Dữ liệu thanh toán do đối tác (SePay, Stripe) xử lý; chúng tôi không lưu số thẻ đầy đủ.'] },
        { heading: 'Khóa API và xử lý trên thiết bị', paragraphs: ['Nếu bạn tự cấu hình khóa API của nhà cung cấp AI, khóa này được lưu trên thiết bị của bạn (on-device) và không được đưa vào nội dung công khai. Bạn chịu trách nhiệm bảo quản khóa của mình.'] },
        { heading: 'Nhà cung cấp AI bên thứ ba', paragraphs: ['Để phiên âm và phân tích, nội dung có thể được gửi tới nhà cung cấp AI mà bạn hoặc dịch vụ lựa chọn. Việc xử lý tại đó tuân theo điều khoản và chính sách của nhà cung cấp tương ứng. Hãy cân nhắc trước khi tải lên dữ liệu nhạy cảm.'] },
        { heading: 'Lưu trữ bản ghi và kết quả', paragraphs: ['Trên thiết bị di động, bản ghi và kết quả có thể được lưu trong không gian làm việc trên máy bạn. Khi sử dụng tài khoản đồng bộ, một số dữ liệu được lưu trên hệ thống của chúng tôi để phục vụ tính năng. Bạn có thể xóa phiên làm việc và dữ liệu liên quan.'] },
        { heading: 'Thanh toán', paragraphs: ['Giao dịch nâng cấp được xử lý bởi SePay và Stripe. Chúng tôi nhận thông tin cần thiết để xác nhận gói dịch vụ (trạng thái thanh toán, mã giao dịch) nhưng không lưu trữ thông tin thẻ đầy đủ.'] },
        { heading: 'Quảng cáo và phân tích', paragraphs: ['Một số trang nội dung có thể hiển thị quảng cáo hoặc dùng công cụ đo lường để cải thiện dịch vụ. Chúng tôi không bán dữ liệu cá nhân và không gắn quảng cáo vào nội dung bản ghi của bạn.'] },
        { heading: 'Quyền truy cập trên thiết bị', paragraphs: ['Ứng dụng di động yêu cầu quyền micro để ghi âm và quyền truy cập mạng để xử lý. Bạn có thể thu hồi các quyền này trong cài đặt hệ điều hành, nhưng một số tính năng sẽ không hoạt động.'] },
        { heading: 'Lưu trữ và xóa dữ liệu', paragraphs: ['Dữ liệu chỉ được lưu trong thời gian cần thiết cho mục đích đã nêu hoặc theo quy định pháp luật. Bạn có thể yêu cầu xóa dữ liệu qua email hỗ trợ.'] },
        { heading: 'Quyền của bạn', paragraphs: ['Bạn có quyền yêu cầu giải thích, truy xuất, chỉnh sửa hoặc xóa dữ liệu phù hợp. Gửi yêu cầu tới support@tsrecord.vn với tiêu đề “Yêu cầu dữ liệu”.'] },
        { heading: 'Thay đổi chính sách', paragraphs: ['Chính sách có thể được cập nhật để phản ánh thay đổi của sản phẩm hoặc quy định. Phiên bản mới sẽ được đăng tại trang này kèm ngày cập nhật. Mọi thắc mắc xin gửi về support@tsrecord.vn.'] },
      ],
    },
    'dieu-khoan': {
      title: 'Điều khoản sử dụng', eyebrow: 'Quy tắc sử dụng',
      description: 'Điều khoản này quy định việc sử dụng website, ứng dụng và nội dung của TSrecord. Cập nhật lần gần nhất: 14/06/2026.',
      sections: [
        { heading: 'Chấp nhận điều khoản', paragraphs: ['Khi truy cập hoặc sử dụng TSrecord, bạn đồng ý với các điều khoản này và Chính sách bảo mật đi kèm. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.'] },
        { heading: 'Mô tả dịch vụ', paragraphs: ['TSrecord cung cấp công cụ ghi âm, chuyển giọng nói thành văn bản, tạo biên bản và tổ chức nội dung trên web và di động. Tính năng có thể thay đổi, bổ sung hoặc ngừng để cải thiện sản phẩm.'] },
        { heading: 'Tài khoản và gói dịch vụ', paragraphs: ['Một số tính năng yêu cầu tài khoản. Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động dưới tài khoản của mình. Dịch vụ hoạt động theo mô hình freemium gồm gói miễn phí và gói nâng cấp có giới hạn sử dụng khác nhau.'] },
        { heading: 'Thanh toán và hoàn tiền', paragraphs: ['Các gói trả phí được thanh toán qua SePay hoặc Stripe theo mức giá hiển thị tại thời điểm mua. Trừ khi có quy định khác hoặc pháp luật bắt buộc, các khoản đã thanh toán cho phần dịch vụ đã sử dụng là không hoàn lại. Vui lòng liên hệ hỗ trợ cho các trường hợp đặc biệt.'] },
        { heading: 'Khóa API và dịch vụ AI bên thứ ba', paragraphs: ['Nếu bạn sử dụng khóa API riêng, bạn chịu trách nhiệm về điều khoản và chi phí với nhà cung cấp đó. TSrecord không kiểm soát và không chịu trách nhiệm về dịch vụ của bên thứ ba.'] },
        { heading: 'Nội dung của bạn', paragraphs: ['Bạn giữ quyền với nội dung mình tải lên. Bạn cam kết có đầy đủ quyền và sự cho phép cần thiết để ghi âm, tải lên và xử lý các tệp đó, đồng thời tuân thủ quy định về quyền riêng tư và sở hữu trí tuệ.'] },
        { heading: 'Tính chính xác của kết quả AI', paragraphs: ['Kết quả phiên âm và phân tích do AI tạo ra có thể chứa sai sót. Bạn cần kiểm tra, đối chiếu với bản ghi gốc và chịu trách nhiệm trước khi sử dụng kết quả cho mục đích quan trọng.'] },
        { heading: 'Hành vi bị cấm', paragraphs: ['Bạn không được sử dụng dịch vụ cho mục đích vi phạm pháp luật, xâm phạm quyền của người khác, tải lên nội dung trái phép, hoặc can thiệp, dò quét, gây quá tải hệ thống.'] },
        { heading: 'Sở hữu trí tuệ', paragraphs: ['Thương hiệu, giao diện, mã nguồn và nội dung của TSrecord thuộc về chúng tôi hoặc bên cấp phép. Bạn không được sao chép, phân phối hay tạo sản phẩm phái sinh khi chưa được phép.'] },
        { heading: 'Giới hạn trách nhiệm', paragraphs: ['Dịch vụ được cung cấp “nguyên trạng”. Trong phạm vi pháp luật cho phép, TSrecord không chịu trách nhiệm cho thiệt hại gián tiếp hoặc mất mát dữ liệu phát sinh từ việc sử dụng dịch vụ.'] },
        { heading: 'Tạm ngừng và chấm dứt', paragraphs: ['Chúng tôi có thể tạm ngừng hoặc chấm dứt quyền truy cập nếu phát hiện vi phạm điều khoản. Bạn có thể ngừng sử dụng và yêu cầu xóa tài khoản bất kỳ lúc nào.'] },
        { heading: 'Luật áp dụng và thay đổi', paragraphs: ['Điều khoản được điều chỉnh theo pháp luật Việt Nam. Chúng tôi có thể cập nhật điều khoản và sẽ đăng phiên bản mới tại trang này kèm ngày cập nhật. Mọi câu hỏi xin gửi về support@tsrecord.vn.'] },
      ],
    },
  },
  en: {
    'gioi-thieu': {
      title: 'About', eyebrow: 'About TSrecord',
      description: 'TSrecord is a tool for recording, turning speech into text, and organizing content for real work — so you replay less and capture exactly what needs to happen.',
      sections: [
        { heading: 'What TSrecord is', paragraphs: ['TSrecord turns a recording or an audio/video file into clear text, meeting notes, and documents you can use right away. Instead of scrubbing back and forth for hours, you get one continuous flow: bring audio in, transcribe, review, and save by project.', 'It works on the web (no installation) and on Android and iOS apps that share the same workspace.'] },
        { heading: 'Three workspaces', paragraphs: ['TSrecord is organized into three parts for different needs within one unified flow:'], bullets: ['Transcribe: upload audio/video or record directly, with continuous text or timestamps.', 'Record & notes: capture audio and notes together, organized by session.', 'Audio editor: trim, merge, and clean recordings before transcription.'] },
        { heading: 'From recordings to actionable documents', paragraphs: ['Results go beyond a long transcript. Depending on context (plain transcription, meeting, or interview), TSrecord can produce summaries, action items, decisions, risks, and content maps — all organized for review, editing, and export to DOCX/PPTX.'] },
        { heading: 'Who it is for', paragraphs: ['TSrecord fits work that deserves careful listening and structured records: meeting minutes, interview transcription, qualitative research, digital content production, study, and personal work.'] },
        { heading: 'Product principles', paragraphs: ['We build TSrecord to be transparent, to respect the source language of recordings, and to keep users in control of the final result.'], bullets: ['Process content for the purpose you requested.', 'Never translate recordings unless asked.', 'Keep the app, content website, and service backend separate.', 'Sensitive access keys never appear in public content.'] },
        { heading: 'Flexible AI and a freemium model', paragraphs: ['TSrecord supports multiple AI providers so you can choose by need and cost. The product is freemium: core features are free and you can upgrade for heavier use, paying via SePay or Stripe.'] },
      ],
    },
    'lien-he': {
      title: 'Contact', eyebrow: 'Connect with the team',
      description: 'Contact us about the product, data, payments, content partnerships, and advertising.',
      metadata: { email: 'support@tsrecord.vn', region: 'Online service for Vietnam and supported markets.' },
      sections: [
        { heading: 'Product support', paragraphs: ['When you hit an issue, email us with your device, operating system, app version, and the steps that caused the problem so the team can investigate quickly. Attach a screenshot if possible.'] },
        { heading: 'Data requests', paragraphs: ['To access, correct, or delete data related to you, put “Data request” in the email subject and write from the email tied to your account so we can verify it.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: 'Privacy policy', eyebrow: 'Data transparency',
      description: 'This policy explains what data TSrecord processes, why, how it is stored, and what rights you have. Last updated: June 14, 2026.',
      sections: [
        { heading: 'Scope', paragraphs: ['This policy applies to the TSrecord website (tsrecord.vn), the web app at /app, and the Android and iOS apps. By using the service, you agree to the data handling described here.'] },
        { heading: 'Information we process', paragraphs: ['We process only the data needed to provide the features you request:'], bullets: ['Account information: email, sign-in details, and plan.', 'Content you bring in: audio, video, recordings, and transcribed text.', 'Technical data: device type, operating system, app version, and basic error logs.', 'Payment data handled by partners (SePay, Stripe); we do not store full card numbers.'] },
        { heading: 'API keys and on-device processing', paragraphs: ['If you configure your own AI provider API key, it is stored on your device and never placed in public content. You are responsible for keeping your key safe.'] },
        { heading: 'Third-party AI providers', paragraphs: ['To transcribe and analyze, content may be sent to the AI provider you or the service selects. Processing there follows that provider’s terms and policy. Consider this before uploading sensitive data.'] },
        { heading: 'Storage of recordings and results', paragraphs: ['On mobile, recordings and results may be stored in a workspace on your device. With a synced account, some data is stored on our systems to power features. You can delete sessions and related data.'] },
        { heading: 'Payments', paragraphs: ['Upgrade transactions are processed by SePay and Stripe. We receive what is needed to confirm your plan (payment status, transaction ID) but do not store full card details.'] },
        { heading: 'Advertising and analytics', paragraphs: ['Some content pages may show ads or use measurement tools to improve the service. We do not sell personal data and do not attach advertising to your recording content.'] },
        { heading: 'Device permissions', paragraphs: ['The mobile app requests microphone access to record and network access to process. You can revoke these in your operating system settings, but some features will not work.'] },
        { heading: 'Retention and deletion', paragraphs: ['Data is kept only as long as needed for the stated purpose or as required by law. You can request deletion via support email.'] },
        { heading: 'Your rights', paragraphs: ['You may request an explanation, access, correction, or deletion where applicable. Send requests to support@tsrecord.vn with the subject “Data request”.'] },
        { heading: 'Changes to this policy', paragraphs: ['We may update this policy to reflect product or regulatory changes. New versions are posted here with an updated date. Questions go to support@tsrecord.vn.'] },
      ],
    },
    'dieu-khoan': {
      title: 'Terms of use', eyebrow: 'Usage rules',
      description: 'These terms govern use of the TSrecord website, app, and content. Last updated: June 14, 2026.',
      sections: [
        { heading: 'Acceptance of terms', paragraphs: ['By accessing or using TSrecord, you agree to these terms and the accompanying Privacy Policy. If you do not agree, please stop using the service.'] },
        { heading: 'Service description', paragraphs: ['TSrecord provides tools to record, turn speech into text, create notes, and organize content on web and mobile. Features may change, be added, or be discontinued to improve the product.'] },
        { heading: 'Accounts and plans', paragraphs: ['Some features require an account. You are responsible for securing your credentials and all activity under your account. The service runs on a freemium model with a free plan and upgrade plans with different usage limits.'] },
        { heading: 'Payments and refunds', paragraphs: ['Paid plans are billed through SePay or Stripe at the price shown at purchase. Unless stated otherwise or required by law, amounts paid for service already used are non-refundable. Contact support for special cases.'] },
        { heading: 'API keys and third-party AI', paragraphs: ['If you use your own API key, you are responsible for that provider’s terms and costs. TSrecord does not control and is not responsible for third-party services.'] },
        { heading: 'Your content', paragraphs: ['You retain rights to the content you upload. You confirm you have the rights and permissions needed to record, upload, and process those files, and that you comply with privacy and intellectual property rules.'] },
        { heading: 'Accuracy of AI results', paragraphs: ['AI-generated transcription and analysis may contain errors. You must review results, check them against the original recording, and take responsibility before using them for important purposes.'] },
        { heading: 'Prohibited use', paragraphs: ['You may not use the service for unlawful purposes, to infringe others’ rights, to upload unauthorized content, or to interfere with, scrape, or overload the system.'] },
        { heading: 'Intellectual property', paragraphs: ['TSrecord’s brand, interface, source code, and content belong to us or our licensors. You may not copy, distribute, or create derivative works without permission.'] },
        { heading: 'Limitation of liability', paragraphs: ['The service is provided “as is”. To the extent permitted by law, TSrecord is not liable for indirect damages or data loss arising from use of the service.'] },
        { heading: 'Suspension and termination', paragraphs: ['We may suspend or terminate access if we detect a breach of these terms. You may stop using the service and request account deletion at any time.'] },
        { heading: 'Governing law and changes', paragraphs: ['These terms are governed by the laws of Vietnam. We may update them and will post new versions here with an updated date. Questions go to support@tsrecord.vn.'] },
      ],
    },
  },
  zh: {
    'gioi-thieu': {
      title: '关于我们', eyebrow: '关于 TSrecord', description: 'TSrecord 是面向实际工作的录音、语音转文字与内容整理工具，帮助你减少重复收听，准确把握需要完成的事项。',
      sections: [
        { heading: 'TSrecord 是什么', paragraphs: ['TSrecord 将一段录音或音视频文件转化为清晰的文字、会议纪要和可直接使用的文档。无需反复倒带，你将获得连贯的流程：导入音频、转写、检查结果并按项目保存。', '产品提供网页版（无需安装）以及 Android、iOS 移动应用，共享同一个工作区。'] },
        { heading: '三个工作空间', paragraphs: ['TSrecord 分为三个部分，在统一流程中满足不同需求：'], bullets: ['转写：导入音视频或直接录音，可选连续文本或带时间戳。', '录音与笔记：边录音边记录笔记，按会话整理。', '音频编辑：在转写前剪辑、合并和处理录音。'] },
        { heading: '从录音到可执行文档', paragraphs: ['结果不止是一份冗长的转写稿。根据场景（普通转写、会议或访谈），TSrecord 可生成摘要、行动项、决定、风险和内容导图，并整理好以便检查、编辑并导出为 DOCX/PPTX。'] },
        { heading: '适用人群', paragraphs: ['TSrecord 适合需要认真倾听和系统记录的工作：会议纪要、访谈转写、定性研究、数字内容制作、学习与个人工作。'] },
        { heading: '产品原则', paragraphs: ['我们坚持透明、尊重录音的原始语言，并让用户掌控最终结果。'], bullets: ['按你要求的目的处理内容。', '未经要求不自动翻译录音。', '明确分离应用、内容网站与服务后端。', '敏感访问密钥绝不出现在公开内容中。'] },
        { heading: '灵活的 AI 与免费增值模式', paragraphs: ['TSrecord 支持多个 AI 服务商，便于按需求和成本选择。产品采用免费增值模式：核心功能免费，需要更多处理时可升级，通过 SePay 或 Stripe 付款。'] },
      ],
    },
    'lien-he': {
      title: '联系我们', eyebrow: '与团队联系', description: '咨询产品、数据、付款、内容合作和广告相关问题。',
      metadata: { email: 'support@tsrecord.vn', region: '在线服务覆盖越南及其他受支持市场。' },
      sections: [
        { heading: '产品支持', paragraphs: ['遇到问题时，请发送邮件并附上设备、操作系统、应用版本以及导致问题的操作步骤，便于团队快速排查。如方便请附上截图。'] },
        { heading: '数据请求', paragraphs: ['如需访问、更正或删除与你相关的数据，请在邮件主题中注明“数据请求”，并使用与账户绑定的邮箱发送，以便核实。'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: '隐私政策', eyebrow: '数据透明', description: '本政策说明 TSrecord 处理哪些数据、用途、存储方式以及你享有的权利。最近更新：2026 年 6 月 14 日。',
      sections: [
        { heading: '适用范围', paragraphs: ['本政策适用于 TSrecord 网站（tsrecord.vn）、/app 网页应用以及 Android、iOS 应用。使用本服务即表示你同意此处所述的数据处理方式。'] },
        { heading: '我们处理的信息', paragraphs: ['我们只处理提供所请求功能所必需的数据：'], bullets: ['账户信息：邮箱、登录信息和套餐。', '你导入的内容：音频、视频、录音和转写文本。', '技术数据：设备类型、操作系统、应用版本和基本错误日志。', '付款数据由合作方（SePay、Stripe）处理；我们不存储完整卡号。'] },
        { heading: 'API 密钥与设备端处理', paragraphs: ['如果你配置自己的 AI 服务商 API 密钥，该密钥保存在你的设备上，不会出现在公开内容中。你需自行妥善保管密钥。'] },
        { heading: '第三方 AI 服务商', paragraphs: ['为进行转写和分析，内容可能被发送至你或服务所选择的 AI 服务商。其处理遵循相应服务商的条款与政策。上传敏感数据前请谨慎考虑。'] },
        { heading: '录音与结果的存储', paragraphs: ['在移动端，录音和结果可能保存在你设备上的工作区中。使用同步账户时，部分数据会保存在我们的系统中以支持相关功能。你可以删除会话及相关数据。'] },
        { heading: '付款', paragraphs: ['升级交易由 SePay 和 Stripe 处理。我们仅接收确认套餐所需的信息（付款状态、交易编号），不存储完整卡片信息。'] },
        { heading: '广告与分析', paragraphs: ['部分内容页面可能展示广告或使用测量工具以改进服务。我们不出售个人数据，也不会把广告附加到你的录音内容上。'] },
        { heading: '设备权限', paragraphs: ['移动应用需要麦克风权限以录音，需要网络权限以处理。你可以在操作系统设置中撤销这些权限，但部分功能将无法使用。'] },
        { heading: '保留与删除', paragraphs: ['数据仅在所述目的所需期间或法律要求的期限内保留。你可以通过支持邮箱请求删除。'] },
        { heading: '你的权利', paragraphs: ['在适用情况下，你可以请求说明、访问、更正或删除数据。请将请求发送至 support@tsrecord.vn，主题为“数据请求”。'] },
        { heading: '政策变更', paragraphs: ['我们可能更新本政策以反映产品或法规变化。新版本将在此页面发布并标注更新日期。如有疑问请联系 support@tsrecord.vn。'] },
      ],
    },
    'dieu-khoan': {
      title: '使用条款', eyebrow: '使用规则', description: '本条款规范对 TSrecord 网站、应用和内容的使用。最近更新：2026 年 6 月 14 日。',
      sections: [
        { heading: '接受条款', paragraphs: ['访问或使用 TSrecord 即表示你同意本条款及随附的隐私政策。如不同意，请停止使用本服务。'] },
        { heading: '服务说明', paragraphs: ['TSrecord 在网页和移动端提供录音、语音转文字、生成笔记和整理内容的工具。为改进产品，功能可能变更、新增或停用。'] },
        { heading: '账户与套餐', paragraphs: ['部分功能需要账户。你需对登录信息的安全及账户下的所有活动负责。本服务采用免费增值模式，包括免费套餐和使用额度不同的升级套餐。'] },
        { heading: '付款与退款', paragraphs: ['付费套餐按购买时显示的价格通过 SePay 或 Stripe 计费。除另有说明或法律要求外，已使用服务部分所支付的款项不予退还。特殊情况请联系支持。'] },
        { heading: 'API 密钥与第三方 AI', paragraphs: ['如果你使用自己的 API 密钥，你需对该服务商的条款和费用负责。TSrecord 不控制也不对第三方服务负责。'] },
        { heading: '你的内容', paragraphs: ['你保留对所上传内容的权利。你确认拥有录制、上传和处理这些文件所需的权利和许可，并遵守隐私和知识产权规定。'] },
        { heading: 'AI 结果的准确性', paragraphs: ['AI 生成的转写和分析可能存在错误。在用于重要用途前，你必须检查结果、与原始录音核对并自行承担责任。'] },
        { heading: '禁止行为', paragraphs: ['你不得将本服务用于违法目的、侵犯他人权利、上传未经授权的内容，或干扰、抓取、使系统过载。'] },
        { heading: '知识产权', paragraphs: ['TSrecord 的品牌、界面、源代码和内容归我们或授权方所有。未经许可，你不得复制、分发或创建衍生作品。'] },
        { heading: '责任限制', paragraphs: ['本服务按“现状”提供。在法律允许的范围内，TSrecord 不对因使用服务而产生的间接损害或数据丢失承担责任。'] },
        { heading: '暂停与终止', paragraphs: ['若发现违反本条款，我们可暂停或终止访问权限。你可以随时停止使用并请求删除账户。'] },
        { heading: '适用法律与变更', paragraphs: ['本条款受越南法律管辖。我们可能更新条款并在此页面发布新版本，标注更新日期。如有疑问请联系 support@tsrecord.vn。'] },
      ],
    },
  },
  ko: {
    'gioi-thieu': {
      title: '소개', eyebrow: 'TSrecord 소개', description: 'TSrecord는 실무를 위한 녹음, 음성-텍스트 변환, 콘텐츠 정리 도구입니다. 다시 듣는 시간을 줄이고 해야 할 일을 정확히 파악하도록 돕습니다.',
      sections: [
        { heading: 'TSrecord란', paragraphs: ['TSrecord는 녹음이나 오디오·비디오 파일을 명확한 텍스트, 회의록, 바로 사용할 수 있는 문서로 바꿔 줍니다. 앞뒤로 반복해 듣는 대신, 오디오 가져오기 → 전사 → 결과 검토 → 프로젝트별 저장으로 이어지는 하나의 흐름을 제공합니다.', '웹(설치 불필요)과 Android·iOS 앱에서 같은 작업 공간을 공유합니다.'] },
        { heading: '세 가지 작업 공간', paragraphs: ['TSrecord는 하나의 통합 흐름 안에서 서로 다른 필요를 위해 세 부분으로 구성됩니다:'], bullets: ['전사: 오디오·비디오 업로드 또는 직접 녹음, 연속 텍스트 또는 타임스탬프 선택.', '녹음 및 노트: 녹음과 노트를 함께 작성하고 세션별로 정리.', '오디오 편집: 전사 전에 녹음을 자르고 합치고 정리.'] },
        { heading: '녹음에서 실행 가능한 문서로', paragraphs: ['결과는 긴 전사문에서 끝나지 않습니다. 상황(일반 전사, 회의, 인터뷰)에 따라 요약, 할 일, 결정, 위험, 콘텐츠 맵을 생성하며, 검토·편집 후 DOCX/PPTX로 내보낼 수 있도록 정리됩니다.'] },
        { heading: '대상 사용자', paragraphs: ['TSrecord는 세심한 청취와 체계적인 기록이 필요한 업무에 적합합니다: 회의록, 인터뷰 전사, 정성 연구, 디지털 콘텐츠 제작, 학습과 개인 작업.'] },
        { heading: '제품 원칙', paragraphs: ['투명성을 지키고 녹음의 원본 언어를 존중하며 사용자가 최종 결과를 관리하도록 합니다.'], bullets: ['요청한 목적에 맞게 콘텐츠를 처리합니다.', '요청 없이 녹음을 번역하지 않습니다.', '앱, 콘텐츠 웹사이트, 서비스 백엔드를 분리합니다.', '민감한 접근 키는 공개 콘텐츠에 포함되지 않습니다.'] },
        { heading: '유연한 AI와 프리미엄 모델', paragraphs: ['TSrecord는 여러 AI 제공업체를 지원하여 필요와 비용에 맞게 선택할 수 있습니다. 제품은 프리미엄(freemium) 모델로, 핵심 기능은 무료이며 더 많은 처리가 필요하면 SePay 또는 Stripe로 결제해 업그레이드할 수 있습니다.'] },
      ],
    },
    'lien-he': {
      title: '문의', eyebrow: '팀에 문의하기', description: '제품, 데이터, 결제, 콘텐츠 제휴, 광고에 관한 문의를 받습니다.',
      metadata: { email: 'support@tsrecord.vn', region: '베트남과 지원되는 시장에 온라인으로 서비스를 제공합니다.' },
      sections: [
        { heading: '제품 지원', paragraphs: ['문제가 발생하면 기기, 운영체제, 앱 버전, 문제가 발생한 단계를 이메일로 보내 주세요. 팀이 더 빠르게 확인할 수 있습니다. 가능하면 스크린샷을 첨부해 주세요.'] },
        { heading: '데이터 요청', paragraphs: ['본인과 관련된 데이터를 열람·수정·삭제하려면 이메일 제목에 “데이터 요청”을 적고, 확인할 수 있도록 계정에 연결된 이메일로 보내 주세요.'] },
      ],
    },
    'chinh-sach-bao-mat': {
      title: '개인정보 처리방침', eyebrow: '데이터 투명성', description: 'TSrecord가 처리하는 데이터, 목적, 보관 방식, 사용자의 권리를 설명합니다. 최종 업데이트: 2026년 6월 14일.',
      sections: [
        { heading: '적용 범위', paragraphs: ['본 방침은 TSrecord 웹사이트(tsrecord.vn), /app 웹 앱, Android·iOS 앱에 적용됩니다. 서비스를 이용하면 여기에 설명된 데이터 처리 방식에 동의하는 것입니다.'] },
        { heading: '처리하는 정보', paragraphs: ['요청한 기능을 제공하는 데 필요한 데이터만 처리합니다:'], bullets: ['계정 정보: 이메일, 로그인 정보, 요금제.', '가져온 콘텐츠: 오디오, 비디오, 녹음, 전사 텍스트.', '기술 데이터: 기기 종류, 운영체제, 앱 버전, 기본 오류 로그.', '결제 데이터는 파트너(SePay, Stripe)가 처리하며 전체 카드 번호는 저장하지 않습니다.'] },
        { heading: 'API 키와 기기 내 처리', paragraphs: ['직접 AI 제공업체 API 키를 설정하면 해당 키는 기기에 저장되며 공개 콘텐츠에 포함되지 않습니다. 키 보관은 사용자 책임입니다.'] },
        { heading: '제3자 AI 제공업체', paragraphs: ['전사와 분석을 위해 콘텐츠가 사용자 또는 서비스가 선택한 AI 제공업체로 전송될 수 있습니다. 해당 처리는 그 제공업체의 약관과 방침을 따릅니다. 민감한 데이터를 업로드하기 전에 신중히 고려하세요.'] },
        { heading: '녹음과 결과의 저장', paragraphs: ['모바일에서는 녹음과 결과가 기기 내 작업 공간에 저장될 수 있습니다. 동기화 계정을 사용하면 일부 데이터가 기능 제공을 위해 당사 시스템에 저장됩니다. 세션과 관련 데이터를 삭제할 수 있습니다.'] },
        { heading: '결제', paragraphs: ['업그레이드 거래는 SePay와 Stripe가 처리합니다. 요금제 확인에 필요한 정보(결제 상태, 거래 번호)를 받지만 전체 카드 정보는 저장하지 않습니다.'] },
        { heading: '광고와 분석', paragraphs: ['일부 콘텐츠 페이지에는 광고가 표시되거나 서비스 개선을 위한 측정 도구가 사용될 수 있습니다. 개인 데이터를 판매하지 않으며 녹음 콘텐츠에 광고를 붙이지 않습니다.'] },
        { heading: '기기 권한', paragraphs: ['모바일 앱은 녹음을 위한 마이크 권한과 처리를 위한 네트워크 권한을 요청합니다. 운영체제 설정에서 권한을 철회할 수 있으나 일부 기능은 작동하지 않습니다.'] },
        { heading: '보관과 삭제', paragraphs: ['데이터는 명시된 목적에 필요한 기간 또는 법령이 정한 기간 동안만 보관됩니다. 지원 이메일로 삭제를 요청할 수 있습니다.'] },
        { heading: '사용자의 권리', paragraphs: ['해당되는 경우 설명, 열람, 수정, 삭제를 요청할 수 있습니다. support@tsrecord.vn로 “데이터 요청” 제목과 함께 보내 주세요.'] },
        { heading: '방침 변경', paragraphs: ['제품이나 규정 변화에 따라 본 방침을 업데이트할 수 있습니다. 새 버전은 업데이트 날짜와 함께 이 페이지에 게시됩니다. 문의는 support@tsrecord.vn.'] },
      ],
    },
    'dieu-khoan': {
      title: '이용약관', eyebrow: '이용 규칙', description: '본 약관은 TSrecord 웹사이트, 앱, 콘텐츠 이용을 규율합니다. 최종 업데이트: 2026년 6월 14일.',
      sections: [
        { heading: '약관 동의', paragraphs: ['TSrecord에 접속하거나 이용하면 본 약관과 함께 제공되는 개인정보 처리방침에 동의하는 것입니다. 동의하지 않으면 서비스 이용을 중단해 주세요.'] },
        { heading: '서비스 설명', paragraphs: ['TSrecord는 웹과 모바일에서 녹음, 음성-텍스트 변환, 노트 작성, 콘텐츠 정리 도구를 제공합니다. 제품 개선을 위해 기능이 변경·추가·중단될 수 있습니다.'] },
        { heading: '계정과 요금제', paragraphs: ['일부 기능은 계정이 필요합니다. 로그인 정보 보안과 계정에서 발생하는 모든 활동에 대한 책임은 사용자에게 있습니다. 서비스는 무료 요금제와 사용 한도가 다른 업그레이드 요금제로 구성된 프리미엄 모델로 운영됩니다.'] },
        { heading: '결제와 환불', paragraphs: ['유료 요금제는 구매 시 표시된 가격으로 SePay 또는 Stripe를 통해 청구됩니다. 별도 명시나 법령상 요구가 없는 한, 이미 사용한 서비스에 대해 지불한 금액은 환불되지 않습니다. 특별한 경우 지원팀에 문의하세요.'] },
        { heading: 'API 키와 제3자 AI', paragraphs: ['직접 API 키를 사용하는 경우 해당 제공업체의 약관과 비용에 대한 책임은 사용자에게 있습니다. TSrecord는 제3자 서비스를 통제하지 않으며 책임지지 않습니다.'] },
        { heading: '사용자의 콘텐츠', paragraphs: ['업로드한 콘텐츠에 대한 권리는 사용자에게 있습니다. 사용자는 해당 파일을 녹음·업로드·처리하는 데 필요한 권리와 허가를 보유하며 개인정보 및 지식재산권 규정을 준수함을 확인합니다.'] },
        { heading: 'AI 결과의 정확성', paragraphs: ['AI가 생성한 전사와 분석에는 오류가 있을 수 있습니다. 중요한 용도로 사용하기 전에 결과를 검토하고 원본 녹음과 대조하며 책임을 져야 합니다.'] },
        { heading: '금지 행위', paragraphs: ['불법적인 목적, 타인의 권리 침해, 무단 콘텐츠 업로드, 시스템 간섭·스크래핑·과부하를 위해 서비스를 이용할 수 없습니다.'] },
        { heading: '지식재산권', paragraphs: ['TSrecord의 브랜드, 인터페이스, 소스 코드, 콘텐츠는 당사 또는 라이선스 제공자에게 귀속됩니다. 허가 없이 복제, 배포, 2차 저작물 제작을 할 수 없습니다.'] },
        { heading: '책임의 제한', paragraphs: ['서비스는 “있는 그대로” 제공됩니다. 법이 허용하는 범위에서 TSrecord는 서비스 이용으로 발생하는 간접 손해나 데이터 손실에 대해 책임지지 않습니다.'] },
        { heading: '이용 정지와 종료', paragraphs: ['약관 위반이 확인되면 접근을 정지하거나 종료할 수 있습니다. 사용자는 언제든지 이용을 중단하고 계정 삭제를 요청할 수 있습니다.'] },
        { heading: '준거법과 변경', paragraphs: ['본 약관은 베트남 법률의 적용을 받습니다. 약관을 업데이트할 수 있으며 새 버전은 업데이트 날짜와 함께 이 페이지에 게시됩니다. 문의는 support@tsrecord.vn.'] },
      ],
    },
  },
};

export const getInfoPageForLocale = (slug: string, locale: SiteLocale) =>
  infoPages[locale][slug] || infoPages.vi[slug];

// Liên kết cửa hàng ứng dụng. Khi app được duyệt, điền URL thật vào đây
// (hoặc đặt qua biến môi trường VITE_ANDROID_STORE_URL / VITE_IOS_STORE_URL).
// Để trống một nền tảng -> trang tải sẽ hiển thị trạng thái "Sắp có".
export const appStores = {
  androidPackageId: 'com.trichxuatamthanh.app',
  appVersion: '1.4.6',
  googlePlay: (import.meta.env.VITE_ANDROID_STORE_URL as string | undefined) || '',
  appStore: (import.meta.env.VITE_IOS_STORE_URL as string | undefined) || '',
  webApp: '/app',
};

type DownloadPlatform = {
  name: string;
  meta: string;
  description: string;
  cta: string;
  comingSoonCta: string;
};

type DownloadContent = {
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  availableNow: string;
  comingSoon: string;
  recommended: string;
  android: DownloadPlatform;
  ios: DownloadPlatform;
  web: DownloadPlatform;
  requirementsTitle: string;
  requirements: string[];
  versionLabel: string;
  helpTitle: string;
  helpText: string;
  helpCta: string;
};

export const downloadCopy: Record<SiteLocale, DownloadContent> = {
  vi: {
    seoTitle: 'Tải ứng dụng TSrecord cho Android và iOS',
    seoDescription: 'Tải TSrecord trên Android và iOS, hoặc dùng ngay trên web. Ghi âm, chuyển giọng nói thành văn bản và tổ chức nội dung trên mọi thiết bị.',
    eyebrow: 'Tải ứng dụng',
    title: 'TSrecord trên mọi thiết bị của bạn.',
    description: 'Dùng ngay trên web mà không cần cài đặt, hoặc tải ứng dụng di động để ghi âm và phiên âm tiện lợi hơn. Dữ liệu và phiên làm việc dùng chung một quy trình.',
    availableNow: 'Đã có',
    comingSoon: 'Sắp có',
    recommended: 'Khuyên dùng',
    android: { name: 'Android', meta: 'Google Play', description: 'Ghi âm trực tiếp, phiên âm và lưu kết quả ngay trên điện thoại Android.', cta: 'Tải trên Google Play', comingSoonCta: 'Sắp lên Google Play' },
    ios: { name: 'iOS', meta: 'App Store', description: 'Trải nghiệm TSrecord trên iPhone và iPad với quyền micro và lưu trữ trên máy.', cta: 'Tải trên App Store', comingSoonCta: 'Sắp lên App Store' },
    web: { name: 'Ứng dụng web', meta: 'Mọi trình duyệt', description: 'Không cần cài đặt. Mở trên trình duyệt máy tính hoặc điện thoại và bắt đầu ngay.', cta: 'Mở ứng dụng web', comingSoonCta: 'Mở ứng dụng web' },
    requirementsTitle: 'Yêu cầu hệ thống',
    requirements: ['Android 8.0 trở lên', 'iOS 14 trở lên', 'Trình duyệt hiện đại (Chrome, Safari, Edge) cho bản web', 'Kết nối internet để xử lý phiên âm'],
    versionLabel: 'Phiên bản hiện tại',
    helpTitle: 'Cần hỗ trợ cài đặt?',
    helpText: 'Nếu gặp khó khăn khi tải hoặc cài ứng dụng, hãy liên hệ đội ngũ của chúng tôi.',
    helpCta: 'Liên hệ hỗ trợ',
  },
  en: {
    seoTitle: 'Download TSrecord for Android and iOS',
    seoDescription: 'Get TSrecord on Android and iOS, or use it on the web. Record, turn speech into text, and organize content across devices.',
    eyebrow: 'Download',
    title: 'TSrecord on all your devices.',
    description: 'Use it on the web with no installation, or get the mobile app for easier recording and transcription. Your data and sessions share one workflow.',
    availableNow: 'Available',
    comingSoon: 'Coming soon',
    recommended: 'Recommended',
    android: { name: 'Android', meta: 'Google Play', description: 'Record, transcribe, and save results right on your Android phone.', cta: 'Get it on Google Play', comingSoonCta: 'Coming to Google Play' },
    ios: { name: 'iOS', meta: 'App Store', description: 'Use TSrecord on iPhone and iPad with microphone access and on-device storage.', cta: 'Download on the App Store', comingSoonCta: 'Coming to the App Store' },
    web: { name: 'Web app', meta: 'Any browser', description: 'No installation needed. Open it in a desktop or mobile browser and start right away.', cta: 'Open the web app', comingSoonCta: 'Open the web app' },
    requirementsTitle: 'System requirements',
    requirements: ['Android 8.0 or later', 'iOS 14 or later', 'A modern browser (Chrome, Safari, Edge) for the web app', 'An internet connection for transcription processing'],
    versionLabel: 'Current version',
    helpTitle: 'Need help installing?',
    helpText: 'If you have trouble downloading or installing the app, reach out to our team.',
    helpCta: 'Contact support',
  },
  zh: {
    seoTitle: '下载 TSrecord（Android 与 iOS）',
    seoDescription: '在 Android 和 iOS 上获取 TSrecord，或直接在网页使用。在各设备上录音、语音转文字并整理内容。',
    eyebrow: '下载应用',
    title: 'TSrecord，适配你的所有设备。',
    description: '无需安装即可在网页使用，或下载移动应用以更方便地录音和转写。数据与会话共享同一流程。',
    availableNow: '已上线',
    comingSoon: '即将推出',
    recommended: '推荐',
    android: { name: 'Android', meta: 'Google Play', description: '在 Android 手机上直接录音、转写并保存结果。', cta: '在 Google Play 下载', comingSoonCta: '即将上线 Google Play' },
    ios: { name: 'iOS', meta: 'App Store', description: '在 iPhone 和 iPad 上使用 TSrecord，支持麦克风权限与设备端存储。', cta: '在 App Store 下载', comingSoonCta: '即将上线 App Store' },
    web: { name: '网页应用', meta: '任意浏览器', description: '无需安装。在电脑或手机浏览器中打开即可开始。', cta: '打开网页应用', comingSoonCta: '打开网页应用' },
    requirementsTitle: '系统要求',
    requirements: ['Android 8.0 及以上', 'iOS 14 及以上', '网页版需现代浏览器（Chrome、Safari、Edge）', '转写处理需要网络连接'],
    versionLabel: '当前版本',
    helpTitle: '需要安装帮助？',
    helpText: '如果在下载或安装应用时遇到问题，请联系我们的团队。',
    helpCta: '联系支持',
  },
  ko: {
    seoTitle: 'TSrecord 다운로드 (Android 및 iOS)',
    seoDescription: 'Android와 iOS에서 TSrecord를 받거나 웹에서 바로 사용하세요. 여러 기기에서 녹음하고 음성을 텍스트로 변환하며 콘텐츠를 정리합니다.',
    eyebrow: '앱 다운로드',
    title: '모든 기기에서 만나는 TSrecord.',
    description: '설치 없이 웹에서 사용하거나, 더 편한 녹음과 전사를 위해 모바일 앱을 받으세요. 데이터와 세션은 하나의 흐름을 공유합니다.',
    availableNow: '제공 중',
    comingSoon: '출시 예정',
    recommended: '추천',
    android: { name: 'Android', meta: 'Google Play', description: 'Android 휴대폰에서 바로 녹음하고 전사하며 결과를 저장하세요.', cta: 'Google Play에서 받기', comingSoonCta: 'Google Play 출시 예정' },
    ios: { name: 'iOS', meta: 'App Store', description: '마이크 권한과 기기 내 저장을 지원하는 iPhone·iPad용 TSrecord를 사용하세요.', cta: 'App Store에서 다운로드', comingSoonCta: 'App Store 출시 예정' },
    web: { name: '웹 앱', meta: '모든 브라우저', description: '설치가 필요 없습니다. 데스크톱이나 모바일 브라우저에서 열고 바로 시작하세요.', cta: '웹 앱 열기', comingSoonCta: '웹 앱 열기' },
    requirementsTitle: '시스템 요구 사항',
    requirements: ['Android 8.0 이상', 'iOS 14 이상', '웹 앱용 최신 브라우저(Chrome, Safari, Edge)', '전사 처리를 위한 인터넷 연결'],
    versionLabel: '현재 버전',
    helpTitle: '설치에 도움이 필요하세요?',
    helpText: '앱 다운로드나 설치에 문제가 있으면 팀에 문의해 주세요.',
    helpCta: '지원 문의',
  },
};
