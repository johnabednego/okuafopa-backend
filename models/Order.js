const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  qty: {
    type: Number,
    required: true,
    min: 1
  },
  priceAtOrder: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true,
    validate: items => items.length > 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending','accepted','rejected','ready','in_transit','delivered','cancelled'],
    default: 'pending'
  },
  deliveryMethod: {
    type: String,
    enum: ['pickup','thirdParty'],
    required: true
  },
  pickupInfo: {
    timeSlot: Date,
    location: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: [Number]  // [lng, lat]
    }
  },
  thirdPartyInfo: {
    partnerOrderId: String,
    eta: Date,
    cost: Number
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// optional geo index if using pickupInfo.location
OrderSchema.index({ 'pickupInfo.location': '2dsphere' });

module.exports = mongoose.model('Order', OrderSchema);
