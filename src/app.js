const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const pool = require('./config/db');

const app = express();
const server = http.createServer(app);

// Socket.IO 설정
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// 미들웨어
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.dir)));

// 라우트
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

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '밥드실분 API 서버가 정상 동작중입니다.' });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({ success: false, message: '요청한 경로를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
});

// ── Socket.IO 실시간 채팅 ──
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

io.on('connection', (socket) => {
  console.log(`소켓 연결: ${socket.user.nickname} (${socket.user.id})`);

  // 채팅방 참여
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`${socket.user.nickname}이(가) 채팅방 ${roomId}에 참여`);
  });

  // 채팅방 나가기
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
  });

  // 메시지 전송
  socket.on('send_message', async ({ roomId, message }) => {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query(
        'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
        [roomId, socket.user.id, message]
      );

      const messageData = {
        id: Number(result.insertId),
        room_id: roomId,
        sender_id: socket.user.id,
        nickname: socket.user.nickname,
        message,
        created_at: new Date().toISOString(),
      };

      io.to(`room_${roomId}`).emit('new_message', messageData);
    } catch (err) {
      console.error('소켓 메시지 전송 오류:', err);
      socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
    } finally {
      if (conn) conn.release();
    }
  });

  socket.on('disconnect', () => {
    console.log(`소켓 해제: ${socket.user.nickname}`);
  });
});

// 서버 시작
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`
  ================================
    밥드실분 API 서버
    포트: ${PORT}
    환경: ${config.nodeEnv}
  ================================
  `);
});

module.exports = { app, server, io };
