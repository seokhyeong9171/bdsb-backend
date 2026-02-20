const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('meeting', 'order', 'payment', 'delivery', 'system'), allowNull: false, defaultValue: 'system' },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    referenceId: { type: DataTypes.INTEGER },
    referenceType: { type: DataTypes.STRING(50) },
  }, {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false,
  });
  return Notification;
};
