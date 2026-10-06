const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isEmailVerified: { type: Boolean, default: false },
    // Only SHA-256 hashes of one-time tokens are stored, never the raw token.
    verificationTokenHash: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetTokenExpires: { type: Date, select: false },
    // JWTs issued before this moment are rejected (set when the password is reset).
    passwordChangedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.verificationTokenHash;
        delete ret.verificationTokenExpires;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetTokenExpires;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
