import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
    userLineId: { type: String, required: true },
    message: { type: String, required: true },
    meetingAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'sent'], default: 'pending' },
});

const Meeting = mongoose.model('Meeting', meetingSchema);

export default Meeting;
