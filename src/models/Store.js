const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Store = sequelize.define('Store', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    ownerId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.ENUM('korean', 'chinese', 'japanese', 'western', 'chicken', 'pizza', 'burger', 'snack', 'dessert', 'etc'), allowNull: false, defaultValue: 'etc' },
    phone: { type: DataTypes.STRING(20) },
    address: { type: DataTypes.TEXT, allowNull: false },
    openTime: { type: DataTypes.TIME },
    closeTime: { type: DataTypes.TIME },
    closedDays: { type: DataTypes.STRING(100) },
    deliveryFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    minOrderAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    thumbnail: { type: DataTypes.STRING(500) },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'stores',
    timestamps: true,
  });
  return Store;
};
