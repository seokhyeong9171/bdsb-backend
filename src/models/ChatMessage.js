const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'chat_messages',
    timestamps: true,
    updatedAt: false,
  });
  return ChatMessage;
};
