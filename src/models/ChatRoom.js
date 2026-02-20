const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatRoom = sequelize.define('ChatRoom', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    meetingId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  }, {
    tableName: 'chat_rooms',
    timestamps: true,
    updatedAt: false,
  });
  return ChatRoom;
};
