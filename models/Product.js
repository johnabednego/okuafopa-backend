const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,   // URL to image
    trim: true
  }],
  category: {
    type: String,
    trim: true,
    index: true
  },
  deliveryOptions: {
    pickup: { type: Boolean, default: true },
    thirdParty: { type: Boolean, default: false }
  },
  // Optionally store a copy of farmer’s location for quick geo‐queries
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number]  // [lng, lat]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create 2dsphere index for geo queries
ProductSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Product', ProductSchema);
