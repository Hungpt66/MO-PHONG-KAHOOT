import { Quiz } from '../types';

export const SAMPLE_EXTERNAL_MINI_GAME_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BIDV Smart-Shield Mini Game</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: #004D2C; color: #fff; padding: 16px; text-align: center; }
    .card { background: #005a33; border: 2px solid #FFCC00; border-radius: 12px; padding: 20px; max-width: 480px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    h2 { color: #FFCC00; font-size: 1.3rem; margin-bottom: 8px; }
    p { font-size: 0.95rem; line-height: 1.4; color: #E8F5E9; margin-bottom: 16px; }
    .scenario { background: #003820; padding: 14px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; font-size: 1rem; color: #fff; border-left: 4px solid #FFCC00; text-align: left; }
    .btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    button { background: #008049; color: #fff; border: 1.5px solid #FFCC00; padding: 14px; border-radius: 8px; font-size: 0.95rem; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    button:hover { background: #FFCC00; color: #004D2C; }
    .badge { display: inline-block; background: #FFCC00; color: #004D2C; font-weight: 800; font-size: 0.8rem; padding: 4px 10px; border-radius: 999px; margin-bottom: 12px; }
    #score-display { font-size: 1.2rem; font-weight: 800; color: #FFCC00; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Google AI Studio Mini-Game Embed</span>
    <h2>🛡️ Thử Thách Vệ Sĩ SmartBanking</h2>
    <p>Xử lý các tình huống bảo mật ngân hàng số để ghi tối đa 1000 điểm cho đội của bạn!</p>
    <div id="game-area">
      <div id="scenario" class="scenario">Đang tải tình huống...</div>
      <div class="btn-grid" id="options"></div>
    </div>
    <div id="score-display">Điểm: 0/1000</div>
  </div>

  <script>
    const scenarios = [
      {
        text: "Tình huống 1: Có tin nhắn SMS từ số lạ xưng là 'Cán bộ kỹ thuật BIDV' yêu cầu bạn đọc mã OTP để nâng hạn mức chuyển tiền.",
        choices: [
          { text: "Từ chối ngay & báo tổng đài 19009247", correct: true, points: 500 },
          { text: "Đọc OTP vì nhân viên nói giọng lịch sự", correct: false, points: 0 }
        ]
      },
      {
        text: "Tình huống 2: Bạn chuẩn bị chuyển khoản số tiền trên 10 triệu đồng theo Quyết định 2345/QĐ-NHNN, ứng dụng yêu cầu bước gì?",
        choices: [
          { text: "Xác thực khuôn mặt (Sinh trắc học eKYC)", correct: true, points: 500 },
          { text: "Nhờ người thân quét giùm mặt", correct: false, points: 0 }
        ]
      }
    ];

    let currentStep = 0;
    let totalScore = 0;

    function renderStep() {
      if (currentStep >= scenarios.length) {
        document.getElementById('game-area').innerHTML = \`
          <div style="padding: 20px; background: #003820; border-radius: 8px;">
            <h3 style="color:#FFCC00; margin-bottom: 8px;">🎉 Hoàn thành thử thách!</h3>
            <p>Tổng điểm đạt được: <strong>\${totalScore} / 1000 điểm</strong></p>
            <p style="font-size: 0.85rem; color: #A5D6A7;">Kết quả đã được gửi tự động về phòng chơi qua postMessage API.</p>
          </div>
        \`;
        // Send postMessage to LMS Container!
        if (window.parent) {
          window.parent.postMessage({
            type: 'game_complete',
            score: totalScore,
            maxScore: 1000,
            details: {
              completedScenarios: scenarios.length,
              source: 'Google AI Studio Mini-Game Embed'
            }
          }, '*');
        }
        return;
      }

      const item = scenarios[currentStep];
      document.getElementById('scenario').textContent = item.text;
      const optsDiv = document.getElementById('options');
      optsDiv.innerHTML = '';
      item.choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.textContent = c.text;
        btn.onclick = () => {
          if (c.correct) {
            totalScore += c.points;
          }
          document.getElementById('score-display').textContent = 'Điểm: ' + totalScore + '/1000';
          currentStep++;
          renderStep();
        };
        optsDiv.appendChild(btn);
      });
    }

    renderStep();
  </script>
</body>
</html>`;

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'bidv-smartbanking-2026',
    title: 'BIDV SmartBanking & An Toàn Bảo Mật Số',
    description: 'Bộ câu hỏi tương tác chuẩn nhận diện BIDV kiểm tra kiến thức về ngân hàng số, sinh trắc học eKYC và bảo mật giao dịch trực tuyến.',
    category: 'Ngân hàng số BIDV',
    coverImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
    createdAt: '2026-03-20T08:00:00Z',
    updatedAt: '2026-03-20T08:00:00Z',
    isPreset: true,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        title: 'Theo Quyết định 2345/QĐ-NHNN, giao dịch chuyển tiền trực tuyến từ bao nhiêu triệu đồng/lần bắt buộc phải xác thực sinh trắc học?',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'opt_1', text: 'Từ 5 triệu đồng trở lên', isCorrect: false },
          { id: 'opt_2', text: 'Từ 10 triệu đồng trở lên', isCorrect: true },
          { id: 'opt_3', text: 'Từ 20 triệu đồng trở lên', isCorrect: false },
          { id: 'opt_4', text: 'Từ 50 triệu đồng trở lên', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        type: 'true_false',
        title: 'Nhân viên BIDV có quyền gọi điện hỏi mật khẩu SmartBanking hoặc mã Smart OTP của khách hàng để hỗ trợ kỹ thuật?',
        timeLimit: 15,
        points: 1000,
        options: [
          { id: 'tf_true', text: 'Đúng (Khi cần kiểm tra tài khoản)', isCorrect: false },
          { id: 'tf_false', text: 'Sai (BIDV KHÔNG BAO GIỜ yêu cầu OTP)', isCorrect: true },
        ],
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        title: 'Ứng dụng ngân hàng số đa kênh thế hệ mới dành riêng cho khách hàng doanh nghiệp của BIDV có tên là gì?',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'opt_31', text: 'BIDV SmartBanking', isCorrect: false },
          { id: 'opt_32', text: 'BIDV iBank', isCorrect: true },
          { id: 'opt_33', text: 'BIDV Home', isCorrect: false },
          { id: 'opt_34', text: 'BIDV Securities', isCorrect: false },
        ],
      },
      {
        id: 'q4',
        type: 'multiple_choice',
        title: 'Khẩu hiệu sứ mệnh (Slogan) truyền thống của Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV) là gì?',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'opt_41', text: 'Chia sẻ cơ hội, hợp tác thành công', isCorrect: true },
          { id: 'opt_42', text: 'Vững bước tương lai, kiến tạo giá trị', isCorrect: false },
          { id: 'opt_43', text: 'Điểm tựa tài chính tin cậy', isCorrect: false },
          { id: 'opt_44', text: 'Đồng hành phát triển thịnh vượng', isCorrect: false },
        ],
      },
      {
        id: 'q5',
        type: 'true_false',
        title: 'Khách hàng có thể chủ động kích hoạt tính năng Khóa thẻ tạm thời ngay trên ứng dụng BIDV SmartBanking khi nghi ngờ lộ thông tin thẻ?',
        timeLimit: 15,
        points: 1000,
        options: [
          { id: 'opt_51', text: 'Đúng (Kích hoạt khóa tức thì 24/7 trên app)', isCorrect: true },
          { id: 'opt_52', text: 'Sai (Bắt buộc phải ra trực tiếp quầy giao dịch)', isCorrect: false },
        ],
      },
    ],
  },
  {
    id: 'bidv-culture-service',
    title: 'Văn Hóa Doanh Nghiệp & Chuẩn Mực Dịch Vụ BIDV',
    description: 'Bộ câu hỏi củng cố văn hóa thương hiệu, chuẩn mực tác phong và quy tắc ứng xử với khách hàng trong hệ sinh thái BIDV.',
    category: 'Văn hóa & Tác phong',
    coverImage: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&auto=format&fit=crop&q=80',
    createdAt: '2026-03-18T10:00:00Z',
    updatedAt: '2026-03-18T10:00:00Z',
    isPreset: true,
    questions: [
      {
        id: 'c1',
        type: 'multiple_choice',
        title: 'Hai màu sắc chủ đạo trên logo chính thức của Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV) là gì?',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'co_1', text: 'Xanh dương và Đỏ cờ', isCorrect: false },
          { id: 'co_2', text: 'Xanh lục bảo (Emerald Green) và Vàng mơ (Apricot Yellow)', isCorrect: true },
          { id: 'co_3', text: 'Đỏ ruby và Vàng ánh kim', isCorrect: false },
          { id: 'co_4', text: 'Xanh lá mạ và Trắng ngọc trai', isCorrect: false },
        ],
      },
      {
        id: 'c2',
        type: 'multiple_choice',
        title: 'Màu vàng mơ trên biểu tượng ngôi sao của BIDV được lấy cảm hứng từ biểu tượng thiêng liêng nào?',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'co_21', text: 'Ngôi sao trên Quốc kỳ Việt Nam', isCorrect: true },
          { id: 'co_22', text: 'Bông lúa vàng phù sa châu thổ', isCorrect: false },
          { id: 'co_23', text: 'Ánh bình minh trên biển Đông', isCorrect: false },
          { id: 'co_24', text: 'Huy chương vàng tài chính châu Á', isCorrect: false },
        ],
      },
      {
        id: 'c3',
        type: 'true_false',
        title: 'Chuẩn mực giao tiếp của giao dịch viên BIDV bao gồm nguyên tắc "4 Xin - 4 Luôn" (Xin chào, xin phép, xin lỗi, xin cảm ơn; Luôn mỉm cười, luôn nhẹ nhàng, luôn lắng nghe, luôn sẵn sàng)?',
        timeLimit: 15,
        points: 1000,
        options: [
          { id: 'ctf_1', text: 'Đúng', isCorrect: true },
          { id: 'ctf_2', text: 'Sai', isCorrect: false },
        ],
      },
    ],
  },
];
