# 밥드실분 (BDSB) Backend

### 해당 프로젝트는 기존의 Spring project로 진행되었던 '밥드실분'을 Claude pro를 이용한 바이브 코딩으로 제작한 프로젝트입니다

### [기존 프로젝트 Notion](https://chaen-notio.notion.site/29c9baa2ab4141bab4855cdb634fe565)
### [기존 프로젝트 Repository](https://github.com/BabDeuSilBun/backend.git)

## 프로젝트 개요

같은 대학의 학생·교직원이 교내/기숙사에서 배달 음식을 함께 주문·수령할 수 있도록 모임을 주선하는 서비스.
최소주문금액 문제, 1인분 제약, 배달비 부담을 해결하고 밥 친구를 찾을 수 있도록 지원한다.

- **서비스명**: 밥드실분
- **기술스택**: Node.js (CommonJS), Express 5, MariaDB, Socket.IO, JWT
- **모듈시스템**: `"type": "commonjs"` — `require/module.exports` 사용
- **스타일**: 모바일웹 대응 REST API + 실시간 채팅(Socket.IO)

## 명령어

```bash
npm install                 # 의존성 설치 (npm 캐시 권한 문제 시 --cache /tmp/npm-cache 옵션 사용)
npm run dev                 # 개발 서버 (nodemon, 포트 3000)
npm start                   # 프로덕션 서버
npm run db:init             # DB 스키마 초기화 + 관리자 계정 생성
```

## 프로젝트 구조

```
src/
├── app.js                          # 엔트리포인트: Express + Socket.IO 서버
├── config/
│   ├── index.js                    # dotenv 기반 환경변수 (port, db, jwt, upload)
│   └── db.js                       # MariaDB 커넥션 풀 (connectionLimit: 10)
├── database/
│   └── init.js                     # 스키마 초기화 (15개 테이블 + admin 계정)
├── middleware/
│   ├── auth.js                     # JWT 인증(authenticate) + 역할 확인(authorize)
│   ├── upload.js                   # Multer 이미지 업로드 (jpeg/png/gif/webp)
│   └── validate.js                 # express-validator 결과 처리
├── controllers/                    # 비즈니스 로직 (11개 컨트롤러)
│   ├── authController.js           # 회원가입(유저/사업자), 로그인
│   ├── userController.js           # 프로필 조회/수정, 탈퇴, 주문내역
│   ├── storeController.js          # 가게 CRUD (사업자)
│   ├── menuController.js           # 메뉴 CRUD (가게 하위)
│   ├── meetingController.js        # ★ 핵심: 모임 생성/참여/주문진행/완료/차액환급
│   ├── orderController.js          # 주문 승인/거절/조리완료/배차/배달완료
│   ├── chatController.js           # 채팅 REST API (Socket.IO 보조)
│   ├── evaluationController.js     # 모임원 평가 (good/normal/bad 뱃지)
│   ├── inquiryController.js        # 문의 게시판
│   ├── imageController.js          # 이미지 등록/조회/대표설정/삭제
│   ├── notificationController.js   # 알림 조회/읽음처리
│   └── adminController.js          # 관리자: 회원관리, 계정정지, 문의답변
├── routes/                         # Express 라우터 (11개)
│   ├── auth.js, users.js, stores.js, meetings.js, orders.js
│   ├── chat.js, evaluations.js, inquiries.js, images.js
│   ├── notifications.js, admin.js
└── utils/
    ├── response.js                 # success()/error() 응답 헬퍼
    └── nickname.js                 # 랜덤 닉네임 생성 (음식 테마)
```

## 데이터베이스 (MariaDB)

### 테이블 목록 (15개)

| 테이블 | 설명 |
|--------|------|
| `users` | 통합 사용자 (role ENUM: user/business/rider/admin) |
| `stores` | 가게 정보 (사업자 소유) |
| `menus` | 가게별 메뉴 |
| `images` | 가게/메뉴 이미지 |
| `meetings` | ★ 모임 (모집→주문→조리→배달→완료→취소) |
| `meeting_members` | 모임 참여자 (meeting_id + user_id UNIQUE) |
| `orders` | 주문 (모임당 1개, meeting_id UNIQUE) |
| `order_items` | 주문 항목 (개인별 메뉴 선택, is_shared 구분) |
| `payments` | 결제 기록 (포인트/카드, 배달비 분담금) |
| `point_history` | 포인트 적립/사용/환급 내역 |
| `evaluations` | 모임원 평가 (meeting+evaluator+target UNIQUE) |
| `chat_rooms` | 채팅방 (모임당 1개 자동 생성) |
| `chat_messages` | 채팅 메시지 |
| `inquiries` | 문의 게시판 |
| `notifications` | 알림 |

- 모든 테이블: `utf8mb4_unicode_ci`, `InnoDB`
- FK CASCADE 삭제: users→stores, stores→menus, meetings→meeting_members, meetings→chat_rooms

### 모임 상태 흐름

```
recruiting → closed → ordered → cooking → delivering → delivered → completed
                                                                  ↘ cancelled
```

### 배달비 계산 로직

- 참여 시: `인당 배달비 = ceil(전체 배달비 / 최소 인원)`
- 완료 시: `환급 포인트 = 참여시 배달비 - ceil(전체 배달비 / 실제 인원)`

## API 라우트 (기본 prefix: `/api`)

| 모듈 | 경로 | 주요 엔드포인트 |
|------|------|----------------|
| auth | `/api/auth` | POST register, register/business, login |
| users | `/api/users` | GET/PUT/DELETE me, GET me/orders, GET :id |
| stores | `/api/stores` | GET /, GET :id, GET my/list, POST/PUT/DELETE :id |
| menus | `/api/stores/:storeId/menus` | GET, POST, PUT :id, DELETE :id |
| meetings | `/api/meetings` | GET /, GET :id, POST /, POST :id/join, POST :id/order, POST :id/complete |
| orders | `/api/orders` | GET store/:storeId, POST :id/approve·reject·cooked·delay |
| deliveries | `/api/orders` | GET deliveries, POST :id/accept-delivery·complete-delivery |
| chat | `/api/chat` | GET meeting/:meetingId, GET room/:roomId/messages, POST room/:roomId/messages |
| evaluations | `/api/evaluations` | GET :meetingId/targets, POST :meetingId |
| inquiries | `/api/inquiries` | POST /, GET my, GET :id |
| images | `/api/images` | POST /, GET /, PUT :id/thumbnail, DELETE :id |
| notifications | `/api/notifications` | GET /, PUT :id/read, PUT read-all |
| admin | `/api/admin` | GET users, PUT users/:id, POST users/:id/suspend, GET/POST inquiries |

## Socket.IO (실시간 채팅)

- **인증**: handshake의 `auth.token`으로 JWT 검증
- **이벤트**:
    - `join_room(roomId)` — 채팅방 입장 (room key: `room_${roomId}`)
    - `leave_room(roomId)` — 채팅방 퇴장
    - `send_message({ roomId, message })` — 메시지 전송 → DB 저장 → `new_message` broadcast
    - `error` — 에러 발생 시 emit

## 환경변수 (.env)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | 3000 |
| `NODE_ENV` | 실행 환경 | development |
| `DB_HOST` | MariaDB 호스트 | localhost |
| `DB_PORT` | MariaDB 포트 | 3306 |
| `DB_USER` | DB 사용자 | root |
| `DB_PASSWORD` | DB 비밀번호 | (빈값) |
| `DB_NAME` | DB 이름 | bdsb |
| `JWT_SECRET` | JWT 서명 키 | — |
| `JWT_EXPIRES_IN` | JWT 만료 기간 | 7d |
| `UPLOAD_DIR` | 업로드 디렉토리 | uploads |
| `MAX_FILE_SIZE` | 최대 파일 크기 (bytes) | 5242880 |

## 초기 관리자 계정

`npm run db:init` 실행 시 생성:
- 이메일: `admin@bdsb.kr`
- 비밀번호: `admin1234`
- 역할: `admin`

## 코딩 규칙

1. **언어**: 한국어 에러 메시지, 변수명은 영어 camelCase
2. **DB 쿼리**: prepared statement (`?` 바인딩) 필수 — SQL injection 방지
3. **소프트 삭제**: stores는 `is_active = 0`, menus는 `is_available = 0`으로 비활성화
4. **에러 로깅**: `console.error('한국어 설명:', err)` 형태
5. **파일 업로드**: `uploads/` 디렉토리, 파일명은 `Date.now()-random.ext`
6. **새 라우트 추가 시**: controller → route 파일 → `app.js`에 `app.use()` 등록
7. **트랜잭션**: 다중 테이블 변경 시 반드시 `beginTransaction/commit/rollback` 사용
8. **닉네임**: 회원가입 시 `utils/nickname.js`로 음식 테마 랜덤 생성

## 미구현 / TODO

- 포트원(PortOne) 실제 결제 연동 (현재 DB 기록만)
- 주문 거절 시 환불 처리 로직
- SNS 로그인 (카카오, 구글 OAuth2)
- 대학교 이메일 인증 (univcert.com 연동)
- 카카오톡 알림 연동
- 라이더 회원가입/관리 (현재 스키마만 존재)
- 관리자 페이지 전체 구현 (일부만 API 존재)
- 이미지 삭제 시 파일시스템 정리
- 모임 마감 자동 처리 (cron/scheduler)
