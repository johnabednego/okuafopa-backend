const mongoose = require('mongoose');

const ProductListingSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductItem', 
    required: true
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
    type: String, // URL to image
    trim: true
  }],
  deliveryOptions: {
    pickup: { type: Boolean, default: true },
    thirdParty: { type: Boolean, default: false }
  },
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number] // [lng, lat]
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

// 2dsphere index for geo-queries
ProductListingSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ProductListing', ProductListingSchema);
