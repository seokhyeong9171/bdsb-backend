# DB 스키마 (MariaDB, 15개 테이블)

모든 테이블: `utf8mb4_unicode_ci`, `InnoDB`

---

## 1. users
```sql
id            INT AUTO_INCREMENT PRIMARY KEY
email         VARCHAR(255) NOT NULL UNIQUE
password      VARCHAR(255) NOT NULL
name          VARCHAR(50) NOT NULL
nickname      VARCHAR(50) NOT NULL UNIQUE
phone         VARCHAR(20) NOT NULL
role          ENUM('user','business','rider','admin') NOT NULL DEFAULT 'user'
university    VARCHAR(100)
campus        VARCHAR(100)
department    VARCHAR(100)
address       TEXT
profile_image VARCHAR(500)
points        INT NOT NULL DEFAULT 0
is_verified   TINYINT(1) NOT NULL DEFAULT 0
is_active     TINYINT(1) NOT NULL DEFAULT 1
business_number VARCHAR(50)
created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 2. stores
```sql
id               INT AUTO_INCREMENT PRIMARY KEY
owner_id         INT NOT NULL → FK users(id) ON DELETE CASCADE
name             VARCHAR(100) NOT NULL
description      TEXT
category         ENUM('korean','chinese','japanese','western','chicken','pizza','burger','snack','dessert','etc') NOT NULL DEFAULT 'etc'
phone            VARCHAR(20)
address          TEXT NOT NULL
open_time        TIME
close_time       TIME
closed_days      VARCHAR(100)
delivery_fee     INT NOT NULL DEFAULT 0
min_order_amount INT NOT NULL DEFAULT 0
thumbnail        VARCHAR(500)
is_active        TINYINT(1) NOT NULL DEFAULT 1
created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 3. menus
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
store_id     INT NOT NULL → FK stores(id) ON DELETE CASCADE
name         VARCHAR(100) NOT NULL
price        INT NOT NULL
description  TEXT
image        VARCHAR(500)
is_available TINYINT(1) NOT NULL DEFAULT 1
created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 4. images
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
uploader_id  INT NOT NULL → FK users(id) ON DELETE CASCADE
target_type  ENUM('store','menu') NOT NULL
target_id    INT NOT NULL
url          VARCHAR(500) NOT NULL
is_thumbnail TINYINT(1) NOT NULL DEFAULT 0
created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```
- FK 없음: target_id는 target_type에 따라 stores.id 또는 menus.id 참조 (다형성)

## 5. meetings
```sql
id               INT AUTO_INCREMENT PRIMARY KEY
leader_id        INT NOT NULL → FK users(id)
store_id         INT NOT NULL → FK stores(id)
title            VARCHAR(200)
dining_type      ENUM('individual','together') NOT NULL DEFAULT 'individual'
order_type       ENUM('instant','reservation') NOT NULL DEFAULT 'instant'
pickup_location  TEXT NOT NULL
meeting_location TEXT
min_members      INT NOT NULL DEFAULT 2
max_members      INT NOT NULL DEFAULT 4
delivery_fee     INT NOT NULL DEFAULT 0
allow_early_order TINYINT(1) NOT NULL DEFAULT 0
deadline         DATETIME NOT NULL
description      TEXT
status           ENUM('recruiting','closed','ordered','cooking','delivering','delivered','completed','cancelled') NOT NULL DEFAULT 'recruiting'
campus           VARCHAR(100)
created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 6. meeting_members
```sql
id         INT AUTO_INCREMENT PRIMARY KEY
meeting_id INT NOT NULL → FK meetings(id) ON DELETE CASCADE
user_id    INT NOT NULL → FK users(id)
is_leader  TINYINT(1) NOT NULL DEFAULT 0
joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY unique_meeting_user (meeting_id, user_id)
```

## 7. orders
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
meeting_id   INT NOT NULL UNIQUE → FK meetings(id)
store_id     INT NOT NULL → FK stores(id)
total_amount INT NOT NULL DEFAULT 0
delivery_fee INT NOT NULL DEFAULT 0
status       ENUM('pending','approved','rejected','cooking','cooked','delivering','delivered','completed','cancelled') NOT NULL DEFAULT 'pending'
rider_id     INT → FK users(id)
delay_reason TEXT
created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 8. order_items
```sql
id         INT AUTO_INCREMENT PRIMARY KEY
order_id   INT NOT NULL → FK orders(id) ON DELETE CASCADE
user_id    INT NOT NULL → FK users(id)
menu_id    INT NOT NULL → FK menus(id)
quantity   INT NOT NULL DEFAULT 1
price      INT NOT NULL
is_shared  TINYINT(1) NOT NULL DEFAULT 0
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

## 9. payments
```sql
id                INT AUTO_INCREMENT PRIMARY KEY
user_id           INT NOT NULL → FK users(id)
meeting_id        INT NOT NULL → FK meetings(id)
amount            INT NOT NULL
delivery_fee_share INT NOT NULL DEFAULT 0
points_used       INT NOT NULL DEFAULT 0
method            ENUM('card','point') NOT NULL DEFAULT 'card'
status            ENUM('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending'
imp_uid           VARCHAR(100)
merchant_uid      VARCHAR(100)
created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 10. point_history
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL → FK users(id)
amount      INT NOT NULL
type        ENUM('earn','use','refund') NOT NULL
description VARCHAR(255)
meeting_id  INT → FK meetings(id)
created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

## 11. evaluations
```sql
id           INT AUTO_INCREMENT PRIMARY KEY
meeting_id   INT NOT NULL → FK meetings(id)
evaluator_id INT NOT NULL → FK users(id)
target_id    INT NOT NULL → FK users(id)
badge        ENUM('good','normal','bad') NOT NULL
created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY unique_evaluation (meeting_id, evaluator_id, target_id)
```

## 12. chat_rooms
```sql
id         INT AUTO_INCREMENT PRIMARY KEY
meeting_id INT NOT NULL UNIQUE → FK meetings(id) ON DELETE CASCADE
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

## 13. chat_messages
```sql
id         INT AUTO_INCREMENT PRIMARY KEY
room_id    INT NOT NULL → FK chat_rooms(id) ON DELETE CASCADE
sender_id  INT NOT NULL → FK users(id)
message    TEXT NOT NULL
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

## 14. inquiries
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL → FK users(id)
title       VARCHAR(200) NOT NULL
content     TEXT NOT NULL
status      ENUM('pending','answered') NOT NULL DEFAULT 'pending'
answer      TEXT
answered_at TIMESTAMP
answered_by INT → FK users(id)
created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## 15. notifications
```sql
id             INT AUTO_INCREMENT PRIMARY KEY
user_id        INT NOT NULL → FK users(id) ON DELETE CASCADE
type           ENUM('meeting','order','payment','delivery','system') NOT NULL DEFAULT 'system'
title          VARCHAR(200) NOT NULL
content        TEXT
is_read        TINYINT(1) NOT NULL DEFAULT 0
reference_id   INT
reference_type VARCHAR(50)
created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## 관계 요약 (Sequelize Association용)

```
User hasMany Store (owner_id)           → CASCADE
User hasMany Meeting (leader_id)
User hasMany MeetingMember (user_id)
User hasMany OrderItem (user_id)
User hasMany Payment (user_id)
User hasMany PointHistory (user_id)
User hasMany Evaluation as evaluator (evaluator_id)
User hasMany Evaluation as target (target_id)
User hasMany ChatMessage (sender_id)
User hasMany Image (uploader_id)        → CASCADE
User hasMany Inquiry (user_id)
User hasMany Notification (user_id)     → CASCADE

Store belongsTo User (owner_id)
Store hasMany Menu (store_id)           → CASCADE
Store hasMany Meeting (store_id)
Store hasMany Order (store_id)

Menu belongsTo Store (store_id)
Menu hasMany OrderItem (menu_id)

Meeting belongsTo User as leader (leader_id)
Meeting belongsTo Store (store_id)
Meeting hasMany MeetingMember (meeting_id) → CASCADE
Meeting hasOne Order (meeting_id)
Meeting hasOne ChatRoom (meeting_id)    → CASCADE
Meeting hasMany Payment (meeting_id)
Meeting hasMany PointHistory (meeting_id)
Meeting hasMany Evaluation (meeting_id)

MeetingMember belongsTo Meeting (meeting_id)
MeetingMember belongsTo User (user_id)

Order belongsTo Meeting (meeting_id)    — UNIQUE
Order belongsTo Store (store_id)
Order belongsTo User as rider (rider_id)
Order hasMany OrderItem (order_id)      → CASCADE

OrderItem belongsTo Order (order_id)
OrderItem belongsTo User (user_id)
OrderItem belongsTo Menu (menu_id)

Payment belongsTo User (user_id)
Payment belongsTo Meeting (meeting_id)

PointHistory belongsTo User (user_id)
PointHistory belongsTo Meeting (meeting_id)

Evaluation belongsTo Meeting (meeting_id)
Evaluation belongsTo User as evaluator (evaluator_id)
Evaluation belongsTo User as target (target_id)

ChatRoom belongsTo Meeting (meeting_id) — UNIQUE
ChatRoom hasMany ChatMessage (room_id)  → CASCADE

ChatMessage belongsTo ChatRoom (room_id)
ChatMessage belongsTo User as sender (sender_id)

Image belongsTo User as uploader (uploader_id)
(polymorphic: target_type + target_id → stores 또는 menus)

Inquiry belongsTo User (user_id)
Inquiry belongsTo User as answerer (answered_by)

Notification belongsTo User (user_id)
```

## 소프트 삭제 패턴
- stores: `is_active = 0` (소프트 삭제)
- menus: `is_available = 0` (소프트 삭제)
- users: 하드 삭제 (DELETE)
