# 컨트롤러별 쿼리 맵 (Sequelize 변환 참조)

> 각 함수의 SQL 쿼리를 Sequelize 메서드로 매핑하기 위한 참조 문서

---

## 1. authController.js
의존성: `bcryptjs`, `jsonwebtoken`, `../config/db`, `../config`, `../utils/response`, `../utils/nickname`

### register
- `SELECT id FROM users WHERE email = ?` → `User.findOne({ where: { email } })`
- `SELECT id FROM users WHERE nickname = ?` → `User.findOne({ where: { nickname } })` (루프, 최대 5회)
- `INSERT INTO users (email, password, name, nickname, phone, department, address, university, campus, role) VALUES (...)` → `User.create({...})`

### registerBusiness
- `SELECT id FROM users WHERE email = ?` → `User.findOne({ where: { email } })`
- `INSERT INTO users (..., role='business') VALUES (...)` → `User.create({..., role: 'business'})`

### login
- `SELECT * FROM users WHERE email = ?` → `User.findOne({ where: { email } })`

---

## 2. userController.js
의존성: `bcryptjs`, `../config/db`, `../utils/response`

### getProfile
- `SELECT (필드 나열) FROM users WHERE id = ?` → `User.findByPk(id, { attributes: [...] })`
- `SELECT COUNT(*) FROM meeting_members mm JOIN meetings m ON mm.meeting_id = m.id WHERE mm.user_id = ? AND m.status = 'completed'` → `MeetingMember.count({ include: [{ model: Meeting, where: { status: 'completed' } }], where: { user_id } })`
- `SELECT badge, COUNT(*) FROM evaluations WHERE target_id = ? GROUP BY badge` → `Evaluation.findAll({ where: { target_id }, attributes: ['badge', [fn('COUNT','*'), 'count']], group: ['badge'] })`

### getUserInfo
- 위와 동일 패턴, 단 제한된 attributes: `id, nickname, department, profile_image`

### updateProfile
- `SELECT password FROM users WHERE id = ?` → `User.findByPk(id, { attributes: ['password'] })`
- `SELECT id FROM users WHERE nickname = ? AND id != ?` → `User.findOne({ where: { nickname, id: { [Op.ne]: userId } } })`
- `UPDATE users SET nickname = COALESCE(?, nickname), profile_image = COALESCE(?, profile_image) WHERE id = ?` → `user.update({ nickname, profile_image })`

### deleteAccount
- `SELECT password, points FROM users WHERE id = ?` → `User.findByPk(id, { attributes: ['password','points'] })`
- `SELECT COUNT(*) FROM meeting_members mm JOIN meetings m ... WHERE mm.user_id = ? AND m.status NOT IN ('completed','cancelled')` → `MeetingMember.count({ include: [...], where: { user_id } })`
- `DELETE FROM users WHERE id = ?` → `user.destroy()`

### getOrderHistory
- 복잡한 JOIN: `payments p → meetings m → orders o → stores s WHERE p.user_id = ?`
- → `Payment.findAll({ where: { user_id }, include: [{ model: Meeting, include: [{ model: Order, include: [Store] }] }], order: ..., limit, offset })`

---

## 3. storeController.js
의존성: `bcryptjs`, `../config/db`, `../utils/response`

### createStore
- `INSERT INTO stores (...) VALUES (...)` → `Store.create({...})`

### getMyStores
- `SELECT * FROM stores WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC` → `Store.findAll({ where: { owner_id, is_active: true }, order: [['created_at','DESC']] })`

### getStore
- `SELECT * FROM stores WHERE id = ? AND is_active = 1` → `Store.findOne({ where: { id, is_active: true } })`
- `SELECT * FROM menus WHERE store_id = ? AND is_available = 1 ORDER BY name` → `Menu.findAll({ where: { store_id, is_available: true }, order: [['name']] })`
- `SELECT * FROM images WHERE target_type = 'store' AND target_id = ?` → `Image.findAll({ where: { target_type: 'store', target_id } })`

### listStores
- 동적 WHERE (category, name LIKE) + pagination → `Store.findAll({ where: { is_active: true, ...동적 }, order, limit, offset })`

### updateStore
- 소유권 확인 + COALESCE 업데이트 → `store.update({...필드})`

### deleteStore
- 소유권 확인 + 비밀번호 확인 + 활성 주문 확인
- `UPDATE stores SET is_active = 0 WHERE id = ?` → `store.update({ is_active: false })`

---

## 4. menuController.js
의존성: `../config/db`, `../utils/response`

### getMenus
- `SELECT * FROM menus WHERE store_id = ? AND is_available = 1 ORDER BY name` → `Menu.findAll({ where: {...}, order: [['name']] })`

### createMenu
- 소유권 확인 → `Menu.create({...})`

### updateMenu
- JOIN으로 소유권 확인: `SELECT m.*, s.owner_id FROM menus m JOIN stores s ON m.store_id = s.id WHERE m.id = ?`
- → `Menu.findByPk(id, { include: [{ model: Store, attributes: ['owner_id'] }] })`
- COALESCE 업데이트 → `menu.update({...})`

### deleteMenu
- 소유권 확인 + `UPDATE menus SET is_available = 0` → `menu.update({ is_available: false })`

---

## 5. meetingController.js ★ 핵심
의존성: `../config/db`, `../utils/response`

### createMeeting [트랜잭션]
1. `INSERT INTO meetings (...)` → `Meeting.create({...})`
2. `INSERT INTO meeting_members (meeting_id, user_id, is_leader=1)` → `MeetingMember.create({...})`
3. `INSERT INTO chat_rooms (meeting_id)` → `ChatRoom.create({...})`
- 비즈니스: deadline ISO→MySQL 변환, 리더 자동 참여, 채팅방 자동 생성

### listMeetings
- 서브쿼리 포함 복잡한 SELECT:
  - `SELECT m.*, s.name, s.category, s.thumbnail, (SELECT COUNT(*) FROM meeting_members WHERE meeting_id = m.id) as current_members, u.nickname as leader_nickname FROM meetings m JOIN stores s ... JOIN users u ... WHERE m.status = 'recruiting' AND m.deadline > NOW() [AND m.campus = ?] [AND s.category = ?]`
- → `Meeting.findAll({ where: { status: 'recruiting', deadline: { [Op.gt]: new Date() }, ...동적 }, include: [Store, { model: User, as: 'leader' }], attributes: { include: [[fn('COUNT',...), 'current_members']] }, ... })`

### getMeeting
- 미팅 상세 + 멤버 + 주문 항목:
  - JOIN: meetings → stores → users (leader)
  - meeting_members → users
  - order_items → orders → menus → users
- → 중첩 include

### joinMeeting [트랜잭션]
1. 미팅 조회 + 현재 멤버 수 서브쿼리
2. 중복 참여 확인
3. `INSERT INTO meeting_members` → `MeetingMember.create()`
4. 주문 조회/생성: `SELECT id FROM orders WHERE meeting_id` → `Order.findOrCreate()`
5. 메뉴 가격 조회 + 주문 항목 생성 (items 배열 루프)
6. `UPDATE orders SET total_amount = total_amount + ?` → `order.increment('total_amount', { by: amount })`
7. 결제 생성 + 포인트 차감 + 포인트 내역 생성
- 배달비 계산: `ceil(delivery_fee / min_members)`

### cancelMenuItem
- 주문 항목 삭제 + 주문 금액 감소
- `DELETE FROM order_items WHERE id = ?` → `orderItem.destroy()`
- `UPDATE orders SET total_amount = total_amount - ?` → `order.decrement('total_amount', { by: amount })`

### processOrder [트랜잭션]
- 리더만 가능, 최소 인원/금액 검증
- 실패 시: meeting+order status → 'cancelled'
- 성공 시: meeting → 'ordered', order → 'pending'

### completeMeeting [트랜잭션]
- 배달비 차액 환급 로직:
  - `실제 인당 = ceil(delivery_fee / current_members)`
  - `초기 인당 = ceil(delivery_fee / min_members)`
  - `환급 = 초기 - 실제` (양수일 때만)
- 전체 멤버에게 포인트 환급 + point_history 기록
- meeting+order → 'completed'

---

## 6. orderController.js
의존성: `../config/db`, `../utils/response`

### getStoreOrders
- 소유권 확인 → 가게 주문 목록 조회 (meetings JOIN, 멤버 수 서브쿼리)

### approveOrder
- 소유권 확인 → order→'approved', meeting→'cooking'

### rejectOrder
- 소유권 확인 → order→'rejected', meeting→'cancelled'
- (TODO: 환불 로직 미구현)

### completeCoking (오타: Cooking)
- 소유권 확인 → order→'cooked', meeting→'delivering'
- 전체 멤버에게 notification 생성 (루프)

### notifyDelay
- 소유권 확인 → order.delay_reason 업데이트
- 전체 멤버에게 notification 생성 (루프)

### getAvailableDeliveries
- `WHERE status = 'cooked' AND rider_id IS NULL` → 미배차 주문

### acceptDelivery
- rider_id 설정 + order→'delivering'

### completeDelivery
- 배정된 라이더만 가능 → order→'delivered', meeting→'delivered'
- 전체 멤버에게 notification 생성

---

## 7. chatController.js
의존성: `../config/db`, `../utils/response`

### getChatRoom
- 멤버 확인 → `ChatRoom.findOne({ where: { meeting_id } })`

### getMessages
- `SELECT cm.*, u.nickname, u.profile_image FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.room_id = ? ORDER BY cm.created_at DESC LIMIT ? OFFSET ?`
- → `ChatMessage.findAll({ where: { room_id }, include: [{ model: User, attributes: ['nickname','profile_image'] }], order: [['created_at','DESC']], limit, offset })`

### sendMessage
- `ChatMessage.create({ room_id, sender_id, message })`

---

## 8. evaluationController.js
의존성: `../config/db`, `../utils/response`

### evaluate
- 완료된 미팅만 + 자기 평가 불가 + 양쪽 모두 멤버여야 함
- `INSERT ... ON DUPLICATE KEY UPDATE badge = ?` → `Evaluation.upsert({ meeting_id, evaluator_id, target_id, badge })`

### getEvaluationTargets
- 나를 제외한 멤버 목록 + 이미 평가한 badge 서브쿼리
- → `MeetingMember.findAll({ where: { meeting_id, user_id: { [Op.ne]: userId } }, include: [User], ... })`

---

## 9. inquiryController.js
의존성: `../config/db`, `../utils/response`

### createInquiry
- `Inquiry.create({ user_id, title, content })`

### getMyInquiries
- `Inquiry.findAll({ where: { user_id }, attributes: ['id','title','status','created_at','answered_at'], order: [['created_at','DESC']] })`

### getInquiry
- `Inquiry.findByPk(id)` + 본인/관리자 권한 확인

---

## 10. imageController.js
의존성: `../config/db`, `../utils/response`

### uploadImage
- Multer 파일 업로드 후 → `Image.create({ uploader_id, target_type, target_id, url })`

### getImages
- 동적 where (target_type, target_id) → `Image.findAll({ where: { uploader_id, ...동적 } })`

### setThumbnail
- 기존 썸네일 해제 → 새 썸네일 설정 → stores.thumbnail 또는 menus.image 업데이트
- → 트랜잭션 권장 (현재 미사용)

### deleteImage
- `image.destroy()` (하드 삭제, 파일시스템 정리 미구현)

---

## 11. notificationController.js
의존성: `../config/db`, `../utils/response`

### getNotifications
- 페이지네이션 + 안읽은 개수
- → `Notification.findAndCountAll({ where: { user_id }, order: [['created_at','DESC']], limit, offset })`
- + `Notification.count({ where: { user_id, is_read: false } })`

### markAsRead
- `Notification.update({ is_read: true }, { where: { id, user_id } })`

### markAllAsRead
- `Notification.update({ is_read: true }, { where: { user_id, is_read: false } })`

---

## 12. adminController.js
의존성: `../config/db`, `../utils/response`

### getUsers
- 동적 where (role, search LIKE) + 페이지네이션
- → `User.findAll({ where: 동적, attributes: { exclude: ['password'] }, order, limit, offset })`

### updateUser
- `user.update({ department, is_active })`

### toggleSuspend
- is_active 토글 (0↔1)

### getInquiries
- JOIN users → `Inquiry.findAll({ include: [{ model: User, attributes: ['name','nickname'] }], where: 동적, order, limit, offset })`

### answerInquiry
- 답변 등록 + notification 생성
- `inquiry.update({ answer, status: 'answered', answered_at: new Date(), answered_by })` + `Notification.create({...})`

---

## app.js (Socket.IO)

### send_message 이벤트
- `INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)`
- → Sequelize 변환 시: `ChatMessage.create({ room_id, sender_id, message })`
- `io.to(room_${roomId}).emit('new_message', messageData)`

---

## 트랜잭션 사용 함수 (Sequelize sequelize.transaction 필요)
1. `meetingController.createMeeting` — 미팅+멤버+채팅방
2. `meetingController.joinMeeting` — 멤버+주문+항목+결제+포인트
3. `meetingController.processOrder` — 미팅+주문 상태 변경
4. `meetingController.completeMeeting` — 포인트 환급+상태 변경

## 알림 생성 위치
- `orderController.completeCoking` — '조리 완료' (전체 멤버)
- `orderController.notifyDelay` — '배달 지연 안내' (전체 멤버)
- `orderController.completeDelivery` — '배달 완료' (전체 멤버)
- `adminController.answerInquiry` — '문의 답변 완료' (문의 작성자)
