import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import express from 'express';
import mongoose from 'mongoose';
import linebot from 'linebot';
import cron from 'node-cron';
import axios from 'axios';
import User from './models/userModel.js';
import Meeting from './models/meetingModels.js';
import moment from 'moment';
dotenv.config();

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('資料庫連線成功');
    })
    .catch((err) => {
        console.log(err)
        console.log('資料庫連線失敗');
    });

const bot = linebot({
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const app = express();
// app.use(bodyParser.json());
const linebotParser = bot.parser();
app.get('/', (req, res) => {
    res.json("Allen's LINEBOT API");
});
app.post('/webhook', linebotParser);
bot.on('message', async (event) => {
    if (event.message.type !== 'text') {
        console.log(event.message.type)
        await event.reply('小秘書看不懂啦');
        console.log("RP")

        return;
    }
    const profile = await event.source.profile();

    const userLineId = profile.userId;
    const userName = profile.displayName;
    const avatar = profile.pictureUrl;

    let user = await User.findOne({ userLineId });
    if (user === null) {
        const newUser = new User({
            userLineId,
            userName,
            avatar,
        });
        await newUser.save();
        user = newUser;
    }
    console.log(user)

    const message = event.message.text;
    //input : 3/20 9:00 A廠商開會
    const formattedDate = convertDate(message);
    console.log(formattedDate);
    const meetingName = extractDetails(message);
    console.log(meetingName);
    const newMeeting = new Meeting({
        userLineId,
        message: meetingName,
        meetingAt: moment(formattedDate, 'YYYY-MM-DD-HH:mm').toDate(),
    });
    await newMeeting.save();
});

function convertDate(input) {
    const currentYear = new Date().getFullYear();
    const [date, time] = input.split(' ');
    const [month, day] = date.split('/');
    const [hour, minute] = time.split(':');
    const formattedDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}-${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    return formattedDate;
}
function extractDetails(input) {
    const regex = /^(\d{1,2}\/\d{1,2} \d{1,2}:\d{2}) (.+)$/;
    const match = input.match(regex);

    if (match) {
        const dateTime = match[1];
        const message = match[2];
        return message;
    } else {
        return null;
    }
}

// cron.schedule('* * * * * *', async () => {
//     console.log('B');
//     const now = new Date();

//     // 設定明天日期（台灣時間）
//     const tomorrow = moment.tz(now, 'Asia/Taipei').add(1, 'days').set({ hour: 23, minute: 15, second: 0, millisecond: 0 }).toDate();
//     console.log(tomorrow);
//     // 查找會議時間為明天且狀態為 pending 的會議
//     const meetings = await Meeting.find({
//         meetingAt: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
//         status: 'pending',
//     });

//     console.log(meetings); // 確認查詢結果

//     for (const meeting of meetings) {
//         // 發送 LINE 訊息
//         console.log('SEND');
//         await axios.post(
//             'https://api.line.me/v2/bot/message/push',
//             {
//                 to: meeting.userLineId,
//                 messages: [{ type: 'text', text: `⏰ 提醒：「${meeting.message}」` }],
//             },
//             {
//                 headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
//             }
//         );

//         // 更新狀態，避免重複提醒
//         meeting.status = 'sent';
//         await meeting.save();
//     }
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
