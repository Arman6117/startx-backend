import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'recruiter'],
    default: 'student',
    required: true
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;
