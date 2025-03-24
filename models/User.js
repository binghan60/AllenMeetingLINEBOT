// models/Todo.js
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    required: true
  }
});

// 為提醒功能創建複合索引
todoSchema.index({ reminderTime: 1, isNotified: 1, isCompleted: 1 });

module.exports = mongoose.model('Todo', todoSchema);
