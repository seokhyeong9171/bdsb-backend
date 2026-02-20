const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { sequelize, ChatMessage } = require('./models');
const logger = require('./utils/logger');
const { startMeetingScheduler } = require('./scheduler/meetingScheduler');
const sanitize = require('./middleware/sanitize');

const app = express();
const server = http.createServer(app);

// CORS 허용 origin 목록
const allowedOrigins = config.corsOrigin
  ? config.corsOrigin.split(',').map((s) => s.trim())
  : true; // CORS_ORIGIN 미설정 시 모든 origin 허용

// Socket.IO 설정
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// io 인스턴스를 다른 모듈에서 사용할 수 있도록 app에 저장
app.set('io', io);

// ── 보안 미들웨어 ──
app.use(helmet());

// 전체 API Rate Limiting (분당 100회)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// 로그인/회원가입 Rate Limiting (15분에 10회)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── 일반 미들웨어 ──
app.use(cors({ origin: allowedOrigins }));
app.use(morgan('dev', {
  stream: { write: (message) => logger.info(message.trim()) },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitize); // XSS 방어 (body, query, params 자동 sanitize)
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.dir)));

// ── 라우트 ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/images', require('./routes/images'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// ── 헬스 체크 ──
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await sequelize.authenticate();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }

  res.json({
    success: true,
    message: '밥드실분 API 서버가 정상 동작중입니다.',
    status: {
      uptime: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      db: { status: dbStatus },
    },
  });
});

// ── 404 처리 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: '요청한 경로를 찾을 수 없습니다.' });
});

// ── 에러 핸들러 ──
app.use((err, req, res, next) => {
  logger.error('서버 오류:', { error: err.message, stack: err.stack, url: req.originalUrl });
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
});

// ── Socket.IO 실시간 채팅 + 이벤트 확장 ──
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('인증 토큰이 필요합니다.'));

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('유효하지 않은 토큰입니다.'));
  }
});

// 사용자별 소켓 맵핑 (알림 푸시용)
const userSockets = new Map();

io.on('connection', (socket) => {
  logger.info(`소켓 연결: ${socket.user.nickname} (${socket.user.id})`);

  // 사용자 소켓 등록 (알림 실시간 푸시용)
  userSockets.set(socket.user.id, socket.id);

  // 채팅방 참여
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    logger.debug(`${socket.user.nickname}이(가) 채팅방 ${roomId}에 참여`);
  });

  // 채팅방 나가기
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
  });

  // 메시지 전송
  socket.on('send_message', async ({ roomId, message }) => {
    try {
      const chatMessage = await ChatMessage.create({
        roomId, senderId: socket.user.id, message,
      });

      const messageData = {
        id: chatMessage.id,
        room_id: roomId,
        sender_id: socket.user.id,
        nickname: socket.user.nickname,
        message,
        created_at: chatMessage.createdAt,
      };

      io.to(`room_${roomId}`).emit('new_message', messageData);
    } catch (err) {
      logger.error('소켓 메시지 전송 오류:', { error: err.message });
      socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
    }
  });

  socket.on('disconnect', () => {
    userSockets.delete(socket.user.id);
    logger.info(`소켓 해제: ${socket.user.nickname}`);
  });
});

// Socket.IO 이벤트 헬퍼 함수들 (컨트롤러에서 사용)
function emitToMeetingRoom(meetingId, event, data) {
  io.to(`room_${meetingId}`).emit(event, data);
}

function emitToUser(userId, event, data) {
  const socketId = userSockets.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
}

// ── DB 동기화 및 서버 시작 ──
const PORT = config.port;

sequelize.sync().then(() => {
  logger.info('데이터베이스 동기화 완료');

  // 스케줄러 시작
  startMeetingScheduler();

  server.listen(PORT, () => {
    logger.info(`
  ================================
    밥드실분 API 서버
    포트: ${PORT}
    환경: ${config.nodeEnv}
  ================================
    `);
  });
}).catch((err) => {
  logger.error('데이터베이스 동기화 실패:', { error: err.message });
  process.exit(1);
});

module.exports = { app, server, io, emitToMeetingRoom, emitToUser };
