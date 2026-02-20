const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PointHistory = sequelize.define('PointHistory', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('earn', 'use', 'refund'), allowNull: false },
    description: { type: DataTypes.STRING(255) },
    meetingId: { type: DataTypes.INTEGER },
  }, {
    tableName: 'point_history',
    timestamps: true,
    updatedAt: false,
  });
  return PointHistory;
};
