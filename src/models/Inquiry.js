const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Inquiry = sequelize.define('Inquiry', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'answered'), allowNull: false, defaultValue: 'pending' },
    answer: { type: DataTypes.TEXT },
    answeredAt: { type: DataTypes.DATE },
    answeredBy: { type: DataTypes.INTEGER },
  }, {
    tableName: 'inquiries',
    timestamps: true,
  });
  return Inquiry;
};
