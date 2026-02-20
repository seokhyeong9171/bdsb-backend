const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Evaluation = sequelize.define('Evaluation', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    meetingId: { type: DataTypes.INTEGER, allowNull: false },
    evaluatorId: { type: DataTypes.INTEGER, allowNull: false },
    targetId: { type: DataTypes.INTEGER, allowNull: false },
    badge: { type: DataTypes.ENUM('good', 'normal', 'bad'), allowNull: false },
  }, {
    tableName: 'evaluations',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { unique: true, fields: ['meeting_id', 'evaluator_id', 'target_id'] },
    ],
  });
  return Evaluation;
};
