# Sequelize 마이그레이션 진행 상황

> 이 파일은 Sequelize ORM 마이그레이션 작업의 진행 상황을 추적합니다.
> 새 세션에서 이 파일을 읽고 이어서 작업하세요.

## 참조 문서
- `docs/sequelize-reference/db-schema.md` — DB 스키마 (16개 테이블)
- `docs/sequelize-reference/controller-queries.md` — 컨트롤러별 SQL→Sequelize 매핑
- `docs/sequelize-reference/routes-middleware.md` — 라우트/미들웨어 구조

## 작업 순서 및 상태

### 1단계: 모델 정의 ✅ 완료
- [x] `src/models/index.js` — Sequelize 초기화 + 전체 association 정의
- [x] `src/models/User.js`
- [x] `src/models/Store.js`
- [x] `src/models/Menu.js`
- [x] `src/models/Image.js`
- [x] `src/models/Meeting.js`
- [x] `src/models/MeetingMember.js`
- [x] `src/models/Order.js`
- [x] `src/models/OrderItem.js`
- [x] `src/models/Payment.js`
- [x] `src/models/PointHistory.js`
- [x] `src/models/Evaluation.js`
- [x] `src/models/ChatRoom.js`
- [x] `src/models/ChatMessage.js`
- [x] `src/models/Inquiry.js`
- [x] `src/models/Notification.js`
- [x] `src/models/RefreshToken.js`

### 2단계: 컨트롤러 Sequelize 전환
- [x] `src/controllers/authController.js` ✅ — register, registerBusiness, login, refresh, logout
- [x] `src/controllers/userController.js` ✅ — getProfile, getUserInfo, updateProfile, deleteAccount, getOrderHistory
- [x] `src/controllers/storeController.js` ✅ — createStore, getMyStores, getStore, listStores, updateStore, deleteStore
- [x] `src/controllers/menuController.js` ✅ — getMenus, createMenu, updateMenu, deleteMenu
- [ ] `src/controllers/meetingController.js` ← **다음 작업** (현재 meetingService.js에 위임 중)
- [ ] `src/services/meetingService.js` ← **다음 작업** (★트랜잭션 핵심: createMeeting, listMeetings, getMeeting, joinMeeting, cancelMenuItem, processOrder, completeMeeting)
- [ ] `src/controllers/orderController.js` ← **다음 작업** (getStoreOrders, approveOrder, rejectOrder, completeCoking, notifyDelay, getAvailableDeliveries, acceptDelivery, completeDelivery)
- [x] `src/controllers/chatController.js` ✅ — getChatRoom, getMessages, sendMessage
- [x] `src/controllers/evaluationController.js` ✅ — evaluate(upsert), getEvaluationTargets
- [x] `src/controllers/inquiryController.js` ✅ — createInquiry, getMyInquiries, getInquiry
- [x] `src/controllers/imageController.js` ✅ — uploadImage, getImages, setThumbnail, deleteImage
- [x] `src/controllers/notificationController.js` ✅ — getNotifications, markAsRead, markAllAsRead
- [x] `src/controllers/adminController.js` ✅ — getUsers, updateUser, toggleSuspend, getInquiries, answerInquiry

### 3단계: 인프라 전환
- [ ] `src/app.js` — Socket.IO send_message 이벤트에서 raw SQL → ChatMessage.create()
- [ ] `src/scheduler/meetingScheduler.js` — raw SQL → Meeting.update()
- [ ] `src/database/init.js` — raw CREATE TABLE → sequelize.sync() + 관리자 시드

### 4단계: 정리
- [ ] `src/config/db.js` 제거 (Sequelize가 대체)
- [ ] 모든 컨트롤러에서 `require('../config/db')` 제거
- [ ] 테스트 실행 및 검증

## 핵심 변환 패턴

### 기존 패턴 (raw SQL)
```js
const pool = require('../config/db');
let conn;
try {
  conn = await pool.getConnection();
  const rows = await conn.query('SELECT * FROM users WHERE id = ?', [id]);
  return success(res, rows[0]);
} catch (err) {
  return error(res, '에러');
} finally {
  if (conn) conn.release();
}
```

### 새 패턴 (Sequelize)
```js
const { User } = require('../models');
try {
  const user = await User.findByPk(id);
  return success(res, user);
} catch (err) {
  logger.error('에러:', { error: err.message });
  return error(res, '에러');
}
```

### 트랜잭션 패턴
```js
const { sequelize, Meeting, MeetingMember, ChatRoom } = require('../models');
const t = await sequelize.transaction();
try {
  const meeting = await Meeting.create({...}, { transaction: t });
  await MeetingMember.create({...}, { transaction: t });
  await ChatRoom.create({...}, { transaction: t });
  await t.commit();
  return success(res, meeting);
} catch (err) {
  await t.rollback();
  logger.error('에러:', { error: err.message });
  return error(res, '에러');
}
```

## 주의사항
- `underscored: true` 설정됨 → camelCase 필드명이 자동으로 snake_case 컬럼에 매핑
- 모든 응답은 `success(res, data, msg)` / `error(res, msg, code)` 헬퍼 사용
- `logger` import: `const logger = require('../utils/logger');`
- 소프트 삭제: stores는 `isActive: false`, menus는 `isAvailable: false`
- ON DUPLICATE KEY UPDATE → `Model.upsert()`
- COALESCE 업데이트 → `instance.update({ field: newValue || undefined })` (undefined는 무시됨)
