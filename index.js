import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import linebot from 'linebot';
import cron from 'node-cron';
import axios from 'axios';
// 讀取環境變數
dotenv.config();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
// 連接 MongoDB
mongoose
    .connect(MONGODB_URI)
    .then(() => {
        console.log('資料庫連線成功');
    })
    .catch((err) => {
        console.log('資料庫連線失敗');
        console.err(err.message);
    });
// 定義 Task Schema
const taskSchema = new mongoose.Schema({
    userId: String,
    message: String,
    remindAt: Date,
});
const Task = mongoose.model('Task', taskSchema);

// 初始化 LINE Bot
const bot = linebot({
    channelId: LINE_CHANNEL_ID,
    channelSecret: LINE_CHANNEL_SECRET,
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
});

// 監聽 LINE 訊息
bot.on('message', async (event) => {
    console.log(event);
    const text = event.message.text.trim();
    const userId = event.source.userId;

    // 判斷格式 "YYYY-MM-DD 事項"
    const match = text.match(/^(\d{4}-\d{2}-\d{2})\s(.+)$/);
    if (match) {
        const [, date, message] = match;
        await Task.create({ userId, message, remindAt: new Date(date) });
        event.reply(`📌 已記錄提醒：「${message}」 於 ${date}`);
    } else {
        event.reply('❗請使用格式：YYYY-MM-DD 事項');
    }
});

// 定時檢查並發送提醒
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const tasks = await Task.find({ remindAt: { $lte: now } });

    for (const task of tasks) {
        await axios.post(
            'https://api.line.me/v2/bot/message/push',
            {
                to: task.userId,
                messages: [{ type: 'text', text: `⏰ 提醒：「${task.message}」` }],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
                },
            }
        );

        // 刪除已發送的提醒
        await Task.findByIdAndDelete(task._id);
    }
});

console.log('✅ 提醒排程已啟動...');

// 啟動 Express 伺服器
const app = express();
app.use(express.json());
app.post('/webhook', bot.parser());

app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
