// index.js
const express = require('express');
const line = require('@line/bot-sdk');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Todo = require('./models/Todo');
const User = require('./models/User');

const app = express();

// LINE Bot 配置
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// MongoDB 連接
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// 解析請求體
app.use('/webhook', line.middleware(config));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LINE Webhook 處理
app.post('/webhook', (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 處理LINE事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const { userId } = event.source;
  const messageText = event.message.text.trim();
  const profile = await client.getProfile(userId);
  let user = await User.findOne({ userId })
  if (user === null) {
    const newUser = new User({
      userId:userId,
      userName: profile.displayName,
      avatar: profile.pictureUrl
    })
    await newUser.save()
    user = newUser
  }
  // 處理待辦事項輸入
  if (messageText.match(/^\d+\/\d+\s+\d+:\d+\s+.+/)) {
    return handleTodoInput(userId, messageText, event.replyToken);
  }
  
  // 處理其他命令
  if (messageText === '列表' || messageText === 'list') {
    return handleListCommand(userId, event.replyToken);
  }

  if (messageText.startsWith('完成 ') || messageText.startsWith('done ')) {
    const todoId = messageText.split(' ')[1];
    return handleCompleteCommand(userId, todoId, event.replyToken);
  }

  if (messageText.startsWith('刪除 ') || messageText.startsWith('delete ')) {
    const todoId = messageText.split(' ')[1];
    return handleDeleteCommand(userId, todoId, event.replyToken);
  }

  // 預設回覆，説明使用方式
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '您可以使用以下格式添加待辦事項：\n日期 時間 內容\n例如：3/20 9:00 A廠商開會\n\n其他命令：\n- 列表：查看所有待辦事項\n- 完成 [ID]：標記待辦事項為已完成\n- 刪除 [ID]：刪除待辦事項'
  });
}

// 處理待辦事項輸入
async function handleTodoInput(userId, text, replyToken) {
  try {
    // 解析輸入文本
    const match = text.match(/^(\d+)\/(\d+)\s+(\d+):(\d+)\s+(.+)$/);
    if (!match) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '格式錯誤，請使用：日期 時間 內容\n例如：3/20 9:00 A廠商開會'
      });
    }

    const [, month, day, hour, minute, content] = match;
    
    // 創建日期時間 (預設為當前年份)
    const currentYear = new Date().getFullYear();
    const reminderTime = moment.tz(`${currentYear}-${month}-${day} ${hour}:${minute}`, 'YYYY-MM-DD HH:mm', 'Asia/Taipei');
    
    // 儲存到資料庫
    const todo = new Todo({
      userId,
      content,
      reminderTime: reminderTime.toDate(),
      isCompleted: false,
      isNotified: false
    });

    await todo.save();

    return client.replyMessage(replyToken, {
      type: 'text',
      text: `已新增待辦事項：\n${reminderTime.format('YYYY/MM/DD HH:mm')} ${content}\n提醒ID: ${todo._id}`
    });
  } catch (error) {
    console.error('Error handling todo input:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '新增待辦事項時發生錯誤，請稍後再試。'
    });
  }
}

// 處理列表命令
async function handleListCommand(userId, replyToken) {
  try {
    const todos = await Todo.find({ 
      userId,
      isCompleted: false
    }).sort({ reminderTime: 1 });

    if (todos.length === 0) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '您目前沒有待辦事項。'
      });
    }

    const todoList = todos.map((todo, index) => {
      const time = moment(todo.reminderTime).tz('Asia/Taipei').format('MM/DD HH:mm');
      return `${index + 1}. [${time}] ${todo.content}\nID: ${todo._id}`;
    }).join('\n\n');

    return client.replyMessage(replyToken, {
      type: 'text',
      text: `您的待辦事項：\n${todoList}`
    });
  } catch (error) {
    console.error('Error handling list command:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '獲取待辦事項列表時發生錯誤，請稍後再試。'
    });
  }
}

// 處理完成命令
async function handleCompleteCommand(userId, todoId, replyToken) {
  try {
    const todo = await Todo.findOneAndUpdate(
      { _id: todoId, userId },
      { isCompleted: true },
      { new: true }
    );

    if (!todo) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '找不到該待辦事項或您無權限修改。'
      });
    }

    return client.replyMessage(replyToken, {
      type: 'text',
      text: `已完成：${todo.content}`
    });
  } catch (error) {
    console.error('Error handling complete command:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '標記待辦事項時發生錯誤，請稍後再試。'
    });
  }
}

// 處理刪除命令
async function handleDeleteCommand(userId, todoId, replyToken) {
  try {
    const todo = await Todo.findOneAndDelete({ _id: todoId, userId });

    if (!todo) {
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '找不到該待辦事項或您無權限刪除。'
      });
    }

    return client.replyMessage(replyToken, {
      type: 'text',
      text: `已刪除：${todo.content}`
    });
  } catch (error) {
    console.error('Error handling delete command:', error);
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '刪除待辦事項時發生錯誤，請稍後再試。'
    });
  }
}

// 定時檢查API端點 - 供Google Apps Script調用
app.post('/api/check-reminders', async (req, res) => {
  try {
    // 檢查API密鑰（簡單的安全措施）
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    // 計算未來1小時的時間
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // 查找未來1小時內將發生且尚未通知的待辦事項
    const todosToNotify = await Todo.find({
      reminderTime: { $gt: now, $lte: oneHourLater },
      isNotified: false,
      isCompleted: false
    });

    console.log(`Found ${todosToNotify.length} upcoming todos within the next hour to notify`);
    
    // 發送通知
    let notifiedCount = 0;
    for (const todo of todosToNotify) {
      try {
        // 計算還有多少分鐘
        const minutesLeft = Math.round((todo.reminderTime - now) / (60 * 1000));
        // 發送提醒訊息（包含剩餘時間）
        await client.pushMessage(todo.userId, {
          type: 'text',
          text: `⏰ 提醒：${todo.content}\n距離開始還有約 ${minutesLeft} 分鐘`
        });

        // 更新為已通知
        todo.isNotified = true;
        await todo.save();
        
        notifiedCount++;
        console.log(`Notification sent for todo: ${todo._id}, minutes left: ${minutesLeft}`);
      } catch (err) {
        console.error(`Error sending notification for todo ${todo._id}:`, err);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Successfully processed ${todosToNotify.length} todos, sent ${notifiedCount} notifications` 
    });
  } catch (error) {
    console.error('Error in check-reminders API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康檢查端點
app.get('/', (req, res) => {
  res.send('LINE Bot server is running!');
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // For Vercel