const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  // ————— Core Identity —————
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },

  // ————— Auth —————
  // holds bcrypt hash; exclude by default
  password: { type: String, required: true, select: false },
  isAdmin: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ['farmer', 'buyer', 'admin'],
    default: 'buyer',
  },
  country: { type: String, required: true },
  city: { type: String, required: true },
  // location: {
  //   type: {
  //     type: String,
  //     enum: ['Point'],
  //     default: 'Point',
  //   },
  //   coordinates: {
  //     type: [Number], // [lng, lat]
  //     default: [],
  //   },
  // },
  profileImage: String,
  notificationPrefs: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  },
  // ————— Verification & Reset via OTP —————
  emailVerified: { type: Boolean, default: false },

  // one-time code (6-digit string), used for either verifying email or resetting pw
  otp: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  otpPurpose: {
    type: String,
    enum: OTP_PURPOSES,
    select: false
  },

  // ————— Auditing —————
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });


// ——— Virtual: fullName ———
userSchema.virtual('fullName')
  .get(function () {
    return `${this.firstName} ${this.lastName}`;
  });


// ——— Pre-save Hook: hash password ———
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});


// ——— Instance Methods ———

/**
 * Generate and store a 6-digit OTP for the given purpose.
 * @param {'emailVerification'|'passwordReset'} purpose
 * @returns {string} the generated OTP
 */
userSchema.methods.generateOTP = function (purpose) {
  if (!OTP_PURPOSES.includes(purpose)) {
    throw new Error(`Invalid OTP purpose: ${purpose}`);
  }
  // 6-digit numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = code;
  this.otpExpiry = Date.now() + 10 * 60 * 1000; // expires in 10m
  this.otpPurpose = purpose;
  return code;
};

/**
 * Verify a provided OTP matches the stored one, is unexpired, and for the right purpose.
 * @param {string} code
 * @param {'emailVerification'|'passwordReset'} purpose
 * @returns {boolean}
 */
userSchema.methods.verifyOTP = function (code, purpose) {
  return (
    this.otp === code &&
    this.otpPurpose === purpose &&
    this.otpExpiry &&
    Date.now() < this.otpExpiry
  );
};

/**
 * Clear out OTP fields (after use).
 */
userSchema.methods.clearOTP = function () {
  this.otp = undefined;
  this.otpExpiry = undefined;
  this.otpPurpose = undefined;
};

/**
 * Compare a plaintext password to the stored hash.
 * Ensure you `.select('+password')` when loading the user.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
userSchema.methods.verifyPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

/**
 * Clean JSON output: strip sensitive fields.
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.otpPurpose;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.OTP_PURPOSES = OTP_PURPOSES;

