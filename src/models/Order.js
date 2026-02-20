const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    meetingId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    totalAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    deliveryFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cooking', 'cooked', 'delivering', 'delivered', 'completed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
    riderId: { type: DataTypes.INTEGER },
    delayReason: { type: DataTypes.TEXT },
  }, {
    tableName: 'orders',
    timestamps: true,
  });
  return Order;
};
