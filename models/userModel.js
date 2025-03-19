import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        userLineId: { type: String, require: true, unique: true },
        userName: { type: String },
        avatar: { type: String }
    },
    {
        timestamps: true,
    }
);
const User = mongoose.model('User', userSchema);
export default User;