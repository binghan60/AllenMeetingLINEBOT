import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import linebot from 'linebot';
import cron from 'node-cron';
import axios from 'axios';

dotenv.config();
const bot = linebot({
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const app = express();
const linebotParser = bot.parser();
app.get('/', (req, res) => {
    res.json("Allen's LINEBOT API");
});
app.post('/webhook', linebotParser);
bot.on('message', async (event) => {
    if (event.message.type !== 'text') {
        await event.reply('小秘書看不懂啦');
        return;
    }
    const message = event.message.text;
    const formattedDate = convertDate(message);
    const meetingName = extractDetails(message);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 http://localhost:${PORT}`);
});
