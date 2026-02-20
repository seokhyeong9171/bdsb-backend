const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Image = sequelize.define('Image', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uploaderId: { type: DataTypes.INTEGER, allowNull: false },
    targetType: { type: DataTypes.ENUM('store', 'menu'), allowNull: false },
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    isThumbnail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: 'images',
    timestamps: true,
    updatedAt: false,
  });
  return Image;
};
