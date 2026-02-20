const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');

const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mariadb',
  logging: config.nodeEnv === 'development' ? (msg) => logger.debug(msg) : false,
  dialectOptions: {
    allowPublicKeyRetrieval: true,
    ...(config.db.ssl && {
      ssl: { rejectUnauthorized: false },
    }),
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    underscored: true, // camelCase → snake_case 자동 변환
    timestamps: true,
  },
});

// ── 모델 import ──
const User = require('./User')(sequelize);
const Store = require('./Store')(sequelize);
const Menu = require('./Menu')(sequelize);
const Image = require('./Image')(sequelize);
const Meeting = require('./Meeting')(sequelize);
const MeetingMember = require('./MeetingMember')(sequelize);
const Order = require('./Order')(sequelize);
const OrderItem = require('./OrderItem')(sequelize);
const Payment = require('./Payment')(sequelize);
const PointHistory = require('./PointHistory')(sequelize);
const Evaluation = require('./Evaluation')(sequelize);
const ChatRoom = require('./ChatRoom')(sequelize);
const ChatMessage = require('./ChatMessage')(sequelize);
const Inquiry = require('./Inquiry')(sequelize);
const Notification = require('./Notification')(sequelize);
const RefreshToken = require('./RefreshToken')(sequelize);

// ── Associations ──

// User ↔ Store (1:N)
User.hasMany(Store, { foreignKey: 'owner_id', as: 'stores' });
Store.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Store ↔ Menu (1:N)
Store.hasMany(Menu, { foreignKey: 'store_id', as: 'menus', onDelete: 'CASCADE' });
Menu.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// User ↔ Image (1:N)
User.hasMany(Image, { foreignKey: 'uploader_id', as: 'images', onDelete: 'CASCADE' });
Image.belongsTo(User, { foreignKey: 'uploader_id', as: 'uploader' });

// Meeting ↔ User (leader)
User.hasMany(Meeting, { foreignKey: 'leader_id', as: 'ledMeetings' });
Meeting.belongsTo(User, { foreignKey: 'leader_id', as: 'leader' });

// Meeting ↔ Store
Store.hasMany(Meeting, { foreignKey: 'store_id', as: 'meetings' });
Meeting.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// Meeting ↔ MeetingMember (1:N)
Meeting.hasMany(MeetingMember, { foreignKey: 'meeting_id', as: 'members', onDelete: 'CASCADE' });
MeetingMember.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });

// User ↔ MeetingMember (1:N)
User.hasMany(MeetingMember, { foreignKey: 'user_id', as: 'meetingMemberships' });
MeetingMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Meeting ↔ Order (1:1)
Meeting.hasOne(Order, { foreignKey: 'meeting_id', as: 'order' });
Order.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });

// Store ↔ Order (1:N)
Store.hasMany(Order, { foreignKey: 'store_id', as: 'orders' });
Order.belongsTo(Store, { foreignKey: 'store_id', as: 'store' });

// User ↔ Order (rider)
User.hasMany(Order, { foreignKey: 'rider_id', as: 'deliveries' });
Order.belongsTo(User, { foreignKey: 'rider_id', as: 'rider' });

// Order ↔ OrderItem (1:N)
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// User ↔ OrderItem
User.hasMany(OrderItem, { foreignKey: 'user_id', as: 'orderItems' });
OrderItem.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Menu ↔ OrderItem
Menu.hasMany(OrderItem, { foreignKey: 'menu_id', as: 'orderItems' });
OrderItem.belongsTo(Menu, { foreignKey: 'menu_id', as: 'menu' });

// User ↔ Payment (1:N)
User.hasMany(Payment, { foreignKey: 'user_id', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Meeting ↔ Payment (1:N)
Meeting.hasMany(Payment, { foreignKey: 'meeting_id', as: 'payments' });
Payment.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });

// User ↔ PointHistory (1:N)
User.hasMany(PointHistory, { foreignKey: 'user_id', as: 'pointHistory' });
PointHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Meeting ↔ PointHistory
Meeting.hasMany(PointHistory, { foreignKey: 'meeting_id', as: 'pointHistory' });
PointHistory.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });

// Evaluations
Meeting.hasMany(Evaluation, { foreignKey: 'meeting_id', as: 'evaluations' });
Evaluation.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });
User.hasMany(Evaluation, { foreignKey: 'evaluator_id', as: 'givenEvaluations' });
Evaluation.belongsTo(User, { foreignKey: 'evaluator_id', as: 'evaluator' });
User.hasMany(Evaluation, { foreignKey: 'target_id', as: 'receivedEvaluations' });
Evaluation.belongsTo(User, { foreignKey: 'target_id', as: 'target' });

// Meeting ↔ ChatRoom (1:1)
Meeting.hasOne(ChatRoom, { foreignKey: 'meeting_id', as: 'chatRoom', onDelete: 'CASCADE' });
ChatRoom.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });

// ChatRoom ↔ ChatMessage (1:N)
ChatRoom.hasMany(ChatMessage, { foreignKey: 'room_id', as: 'messages', onDelete: 'CASCADE' });
ChatMessage.belongsTo(ChatRoom, { foreignKey: 'room_id', as: 'room' });

// User ↔ ChatMessage
User.hasMany(ChatMessage, { foreignKey: 'sender_id', as: 'chatMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

// User ↔ Inquiry (1:N)
User.hasMany(Inquiry, { foreignKey: 'user_id', as: 'inquiries' });
Inquiry.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Inquiry, { foreignKey: 'answered_by', as: 'answeredInquiries' });
Inquiry.belongsTo(User, { foreignKey: 'answered_by', as: 'answerer' });

// User ↔ Notification (1:N)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User ↔ RefreshToken (1:N)
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Store,
  Menu,
  Image,
  Meeting,
  MeetingMember,
  Order,
  OrderItem,
  Payment,
  PointHistory,
  Evaluation,
  ChatRoom,
  ChatMessage,
  Inquiry,
  Notification,
  RefreshToken,
};
