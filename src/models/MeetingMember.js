const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MeetingMember = sequelize.define('MeetingMember', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    meetingId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    isLeader: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'meeting_members',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['meeting_id', 'user_id'] },
    ],
  });
  return MeetingMember;
};
