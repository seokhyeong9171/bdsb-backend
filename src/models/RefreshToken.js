const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING(500), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'refresh_tokens',
    timestamps: true,
    updatedAt: false,
  });
  return RefreshToken;
};
