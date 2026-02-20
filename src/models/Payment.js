const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    meetingId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    deliveryFeeShare: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    pointsUsed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    method: { type: DataTypes.ENUM('card', 'point'), allowNull: false, defaultValue: 'card' },
    status: { type: DataTypes.ENUM('pending', 'paid', 'refunded', 'cancelled'), allowNull: false, defaultValue: 'pending' },
    impUid: { type: DataTypes.STRING(100) },
    merchantUid: { type: DataTypes.STRING(100) },
  }, {
    tableName: 'payments',
    timestamps: true,
  });
  return Payment;
};
