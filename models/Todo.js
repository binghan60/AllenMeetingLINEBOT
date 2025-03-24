// models/Todo.js
const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  reminderTime: {
    type: Date,
    required: true,
    index: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  isNotified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 為提醒功能創建複合索引
todoSchema.index({ reminderTime: 1, isNotified: 1, isCompleted: 1 });

module.exports = mongoose.model('Todo', todoSchema);
