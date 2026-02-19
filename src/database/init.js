const mariadb = require('mariadb');
const config = require('../config');

async function initDatabase() {
  // 먼저 DB 없이 연결하여 데이터베이스 생성
  const conn = await mariadb.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${config.db.database}\``);

  // ── 사용자 (유저, 사업자, 라이더, 관리자 통합) ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(50) NOT NULL,
      nickname VARCHAR(50) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL,
      role ENUM('user', 'business', 'rider', 'admin') NOT NULL DEFAULT 'user',
      university VARCHAR(100),
      campus VARCHAR(100),
      department VARCHAR(100),
      address TEXT,
      profile_image VARCHAR(500),
      points INT NOT NULL DEFAULT 0,
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      business_number VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 가게 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      category ENUM('korean', 'chinese', 'japanese', 'western', 'chicken', 'pizza', 'burger', 'snack', 'dessert', 'etc') NOT NULL DEFAULT 'etc',
      phone VARCHAR(20),
      address TEXT NOT NULL,
      open_time TIME,
      close_time TIME,
      closed_days VARCHAR(100),
      delivery_fee INT NOT NULL DEFAULT 0,
      min_order_amount INT NOT NULL DEFAULT 0,
      thumbnail VARCHAR(500),
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 메뉴 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      price INT NOT NULL,
      description TEXT,
      image VARCHAR(500),
      is_available TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 이미지 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uploader_id INT NOT NULL,
      target_type ENUM('store', 'menu') NOT NULL,
      target_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      is_thumbnail TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 모임 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      leader_id INT NOT NULL,
      store_id INT NOT NULL,
      title VARCHAR(200),
      dining_type ENUM('individual', 'together') NOT NULL DEFAULT 'individual',
      order_type ENUM('instant', 'reservation') NOT NULL DEFAULT 'instant',
      pickup_location TEXT NOT NULL,
      meeting_location TEXT,
      min_members INT NOT NULL DEFAULT 2,
      max_members INT NOT NULL DEFAULT 4,
      delivery_fee INT NOT NULL DEFAULT 0,
      allow_early_order TINYINT(1) NOT NULL DEFAULT 0,
      deadline DATETIME NOT NULL,
      description TEXT,
      status ENUM('recruiting', 'closed', 'ordered', 'cooking', 'delivering', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'recruiting',
      campus VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 모임 참여자 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS meeting_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      user_id INT NOT NULL,
      is_leader TINYINT(1) NOT NULL DEFAULT 0,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_meeting_user (meeting_id, user_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 주문 (모임 단위) ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL UNIQUE,
      store_id INT NOT NULL,
      total_amount INT NOT NULL DEFAULT 0,
      delivery_fee INT NOT NULL DEFAULT 0,
      status ENUM('pending', 'approved', 'rejected', 'cooking', 'cooked', 'delivering', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
      rider_id INT,
      delay_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (rider_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 주문 항목 (개인별 메뉴 선택) ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      user_id INT NOT NULL,
      menu_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      price INT NOT NULL,
      is_shared TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (menu_id) REFERENCES menus(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 결제 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      meeting_id INT NOT NULL,
      amount INT NOT NULL,
      delivery_fee_share INT NOT NULL DEFAULT 0,
      points_used INT NOT NULL DEFAULT 0,
      method ENUM('card', 'point') NOT NULL DEFAULT 'card',
      status ENUM('pending', 'paid', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
      imp_uid VARCHAR(100),
      merchant_uid VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 포인트 내역 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS point_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount INT NOT NULL,
      type ENUM('earn', 'use', 'refund') NOT NULL,
      description VARCHAR(255),
      meeting_id INT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 평가 뱃지 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      evaluator_id INT NOT NULL,
      target_id INT NOT NULL,
      badge ENUM('good', 'normal', 'bad') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_evaluation (meeting_id, evaluator_id, target_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (evaluator_id) REFERENCES users(id),
      FOREIGN KEY (target_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 채팅방 (모임별 자동 생성) ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 채팅 메시지 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_id INT NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 문의 게시판 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      status ENUM('pending', 'answered') NOT NULL DEFAULT 'pending',
      answer TEXT,
      answered_at TIMESTAMP,
      answered_by INT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (answered_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 알림 ──
  await conn.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('meeting', 'order', 'payment', 'delivery', 'system') NOT NULL DEFAULT 'system',
      title VARCHAR(200) NOT NULL,
      content TEXT,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      reference_id INT,
      reference_type VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 관리자 기본 계정 생성 ──
  const bcrypt = require('bcryptjs');
  const hashedPw = await bcrypt.hash('admin1234', 10);
  await conn.query(`
    INSERT IGNORE INTO users (email, password, name, nickname, phone, role, is_verified, is_active)
    VALUES ('admin@bdsb.kr', ?, '관리자', 'admin', '010-0000-0000', 'admin', 1, 1)
  `, [hashedPw]);

  console.log('데이터베이스 초기화 완료!');
  await conn.end();
  process.exit(0);
}

initDatabase().catch(err => {
  console.error('데이터베이스 초기화 실패:', err);
  process.exit(1);
});
