# 라우트 & 미들웨어 구조

---

## 미들웨어

### auth.js
- `authenticate`: `Authorization: Bearer <token>` → JWT 검증 → `req.user = { id, email, role, nickname }`
  - 401: "인증 토큰이 필요합니다." / "유효하지 않은 토큰입니다."
- `authorize(...roles)`: `req.user.role`이 roles에 포함되는지 확인
  - 403: "접근 권한이 없습니다."

### upload.js
- `multer.diskStorage`: 목적지 `config.upload.dir`, 파일명 `{Date.now()}-{random}.{ext}`
- 허용: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- 최대: `config.upload.maxFileSize` (5MB)
- 사용법: `upload.single('image')`

### validate.js
- `express-validator`의 `validationResult(req)` 체크
- 에러 시 400: `{ success: false, message: "입력값이 올바르지 않습니다.", errors: [...] }`

---

## 라우트 상세

### /api/auth (public, 인증 불필요)
| Method | Path | Validation | Controller |
|--------|------|-----------|------------|
| POST | /register | email(isEmail), password(min6), name(notEmpty), phone(notEmpty) | register |
| POST | /register/business | email(isEmail), password(min6), name(notEmpty), phone(notEmpty), businessNumber(notEmpty) | registerBusiness |
| POST | /login | email(isEmail), password(notEmpty) | login |

### /api/users (authenticate 필수)
| Method | Path | Auth | Controller |
|--------|------|------|------------|
| GET | /me | authenticate | getProfile |
| PUT | /me | authenticate | updateProfile |
| DELETE | /me | authenticate | deleteAccount |
| GET | /me/orders | authenticate | getOrderHistory |
| GET | /:id | authenticate | getUserInfo |

### /api/stores
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| GET | / | authenticate | — | listStores |
| GET | /:id | authenticate | — | getStore |
| GET | /my/list | authenticate, authorize('business') | — | getMyStores |
| POST | / | authenticate, authorize('business') | name(notEmpty), address(notEmpty) | createStore |
| PUT | /:id | authenticate, authorize('business') | — | updateStore |
| DELETE | /:id | authenticate, authorize('business') | — | deleteStore |

### /api/stores/:storeId/menus (stores 라우터에 중첩)
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| GET | / | authenticate | — | getMenus |
| POST | / | authenticate, authorize('business') | name(notEmpty), price(isInt,min0) | createMenu |
| PUT | /:id | authenticate, authorize('business') | — | updateMenu |
| DELETE | /:id | authenticate, authorize('business') | — | deleteMenu |

### /api/meetings
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| GET | / | authenticate | — | listMeetings |
| GET | /:id | authenticate | — | getMeeting |
| POST | / | authenticate | storeId(isInt), pickupLocation(notEmpty), deadline(isISO8601) | createMeeting |
| POST | /:id/join | authenticate | — | joinMeeting |
| DELETE | /order-items/:orderItemId | authenticate | — | cancelMenuItem |
| POST | /:id/order | authenticate | — | processOrder |
| POST | /:id/complete | authenticate | — | completeMeeting |

### /api/orders
**사업자용 (authorize('business')):**
| Method | Path | Controller |
|--------|------|------------|
| GET | /store/:storeId | getStoreOrders |
| POST | /:orderId/approve | approveOrder |
| POST | /:orderId/reject | rejectOrder |
| POST | /:orderId/cooked | completeCoking |
| POST | /:orderId/delay | notifyDelay |

**라이더용 (authorize('rider')):**
| Method | Path | Controller |
|--------|------|------------|
| GET | /deliveries | getAvailableDeliveries |
| POST | /:orderId/accept-delivery | acceptDelivery |
| POST | /:orderId/complete-delivery | completeDelivery |

### /api/chat
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| GET | /meeting/:meetingId | authenticate | — | getChatRoom |
| GET | /room/:roomId/messages | authenticate | — | getMessages |
| POST | /room/:roomId/messages | authenticate | message(notEmpty) | sendMessage |

### /api/evaluations
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| GET | /:meetingId/targets | authenticate | — | getEvaluationTargets |
| POST | /:meetingId | authenticate | targetId(isInt), badge(isIn['good','normal','bad']) | evaluate |

### /api/inquiries
| Method | Path | Auth | Validation | Controller |
|--------|------|------|-----------|------------|
| POST | / | authenticate | title(notEmpty), content(notEmpty) | createInquiry |
| GET | /my | authenticate | — | getMyInquiries |
| GET | /:id | authenticate | — | getInquiry |

### /api/images (authorize('business') 전체)
| Method | Path | Middleware | Controller |
|--------|------|-----------|------------|
| POST | / | upload.single('image') | uploadImage |
| GET | / | — | getImages |
| PUT | /:id/thumbnail | — | setThumbnail |
| DELETE | /:id | — | deleteImage |

### /api/notifications
| Method | Path | Auth | Controller |
|--------|------|------|------------|
| GET | / | authenticate | getNotifications |
| PUT | /:id/read | authenticate | markAsRead |
| PUT | /read-all | authenticate | markAllAsRead |

### /api/admin (router.use(authenticate, authorize('admin')))
| Method | Path | Validation | Controller |
|--------|------|-----------|------------|
| GET | /users | — | getUsers |
| PUT | /users/:id | — | updateUser |
| POST | /users/:id/suspend | — | toggleSuspend |
| GET | /inquiries | — | getInquiries |
| POST | /inquiries/:id/answer | answer(notEmpty) | answerInquiry |

---

## Validation 메시지 사전
| 필드 | 메시지 |
|------|--------|
| email | "유효한 이메일을 입력하세요." |
| password (register) | "비밀번호는 최소 6자 이상이어야 합니다." |
| password (login) | "비밀번호를 입력하세요." |
| name | "이름을 입력하세요." |
| phone | "휴대폰번호를 입력하세요." |
| businessNumber | "사업자번호를 입력하세요." |
| store.name | "가게 이름을 입력하세요." |
| store.address | "주소를 입력하세요." |
| menu.name | "메뉴 이름을 입력하세요." |
| menu.price | "가격을 올바르게 입력하세요." |
| storeId | "가게를 선택하세요." |
| pickupLocation | "수령 장소를 입력하세요." |
| deadline | "마감 기한을 올바르게 입력하세요." |
| message | "메시지를 입력하세요." |
| targetId | "평가 대상을 선택하세요." |
| badge | "올바른 평가를 선택하세요." |
| inquiry.title | "제목을 입력하세요." |
| inquiry.content | "내용을 입력하세요." |
| answer | "답변 내용을 입력하세요." |

---

## app.js 라우트 등록 순서
```js
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
```

## config/index.js 기본값
```js
port: 3000, nodeEnv: 'development'
db: { host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'BDSB' }
jwt: { secret: 'default_secret', expiresIn: '7d' }
upload: { dir: 'uploads', maxFileSize: 5242880 }
```

## utils/nickname.js
- 형식: `{형용사}{음식}{0~9999}` (예: "배고픈치킨1234")
- 형용사 15개, 음식 15개
- `generateNickname()` export
