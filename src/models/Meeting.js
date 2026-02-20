const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Meeting = sequelize.define('Meeting', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    leaderId: { type: DataTypes.INTEGER, allowNull: false },
    storeId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200) },
    diningType: { type: DataTypes.ENUM('individual', 'together'), allowNull: false, defaultValue: 'individual' },
    orderType: { type: DataTypes.ENUM('instant', 'reservation'), allowNull: false, defaultValue: 'instant' },
    pickupLocation: { type: DataTypes.TEXT, allowNull: false },
    meetingLocation: { type: DataTypes.TEXT },
    minMembers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
    maxMembers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    deliveryFee: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    allowEarlyOrder: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    deadline: { type: DataTypes.DATE, allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('recruiting', 'closed', 'ordered', 'cooking', 'delivering', 'delivered', 'completed', 'cancelled'), allowNull: false, defaultValue: 'recruiting' },
    campus: { type: DataTypes.STRING(100) },
  }, {
    tableName: 'meetings',
    timestamps: true,
  });
  return Meeting;
};
