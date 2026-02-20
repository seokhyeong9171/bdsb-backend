const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(50), allowNull: false },
    nickname: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    role: { type: DataTypes.ENUM('user', 'business', 'rider', 'admin'), allowNull: false, defaultValue: 'user' },
    university: { type: DataTypes.STRING(100) },
    campus: { type: DataTypes.STRING(100) },
    department: { type: DataTypes.STRING(100) },
    address: { type: DataTypes.TEXT },
    profileImage: { type: DataTypes.STRING(500) },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    businessNumber: { type: DataTypes.STRING(50) },
  }, {
    tableName: 'users',
    timestamps: true,
  });
  return User;
};
