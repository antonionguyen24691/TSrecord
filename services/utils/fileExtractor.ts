import JSZip from 'jszip';
import mammoth from 'mammoth';

/**
 * Đọc nội dung file text thuần (txt, md)
 */
const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error(`Không thể đọc file text: ${file.name}`));
    };
    reader.readAsText(file, 'UTF-8');
  });
};

/**
 * Đọc nội dung file Word (.docx) bằng mammoth
 */
const readDocxFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value || '');
      } catch (error) {
        reject(new Error(`Không thể trích xuất text từ file DOCX: ${file.name}. Vui lòng thử lại.`));
      }
    };
    reader.onerror = () => {
      reject(new Error(`Không thể đọc file DOCX: ${file.name}`));
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Đọc nội dung file PowerPoint (.pptx) bằng JSZip và DOMParser
 */
const readPptxFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Tìm tất cả các file slides trong ppt/slides/slide*.xml
        const slideFiles = Object.keys(zip.files).filter(path => 
          /^ppt\/slides\/slide\d+\.xml$/i.test(path)
        );

        if (slideFiles.length === 0) {
          resolve('');
          return;
        }

        // Sắp xếp các slide theo số thứ tự (slide1.xml, slide2.xml, slide10.xml...)
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.replace(/[^\d]/g, ''), 10);
          const numB = parseInt(b.replace(/[^\d]/g, ''), 10);
          return numA - numB;
        });

        const parser = new DOMParser();
        const slidesText: string[] = [];

        for (let i = 0; i < slideFiles.length; i++) {
          const slidePath = slideFiles[i];
          const xmlText = await zip.files[slidePath].async('text');
          const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
          
          // Thẻ chứa text chạy trong PPTX XML thường là <a:t>
          const textElements = xmlDoc.getElementsByTagName('a:t');
          const slideTextContent = Array.from(textElements)
            .map(el => el.textContent || '')
            .filter(text => text.trim().length > 0)
            .join(' ');
          
          if (slideTextContent.trim()) {
            slidesText.push(`[Slide ${i + 1}]: ${slideTextContent}`);
          }
        }

        resolve(slidesText.join('\n\n'));
      } catch (error) {
        reject(new Error(`Không thể trích xuất text từ file PPTX: ${file.name}. Vui lòng thử lại.`));
      }
    };
    reader.onerror = () => {
      reject(new Error(`Không thể đọc file PPTX: ${file.name}`));
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Hàm tổng quát để trích xuất văn bản từ nhiều loại file bổ trợ khác nhau.
 * Trả về văn bản đã trích xuất, hoặc chuỗi rỗng nếu file không được hỗ trợ.
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
    case 'md':
      return await readTextFile(file);
    case 'docx':
      return await readDocxFile(file);
    case 'pptx':
      return await readPptxFile(file);
    default:
      // Các định dạng khác như PDF (được gửi trực tiếp) hoặc các định dạng nhị phân không hỗ trợ ở client-side
      return '';
  }
};

/**
 * Kiểm tra xem file có thể giải nén/trích xuất text ở client-side hay không.
 */
export const isClientSideExtractable = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ['txt', 'md', 'docx', 'pptx'].includes(extension || '');
};

/**
 * Kiểm tra xem file có phải là PDF hay không.
 */
export const isPdfFile = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'pdf';
};
