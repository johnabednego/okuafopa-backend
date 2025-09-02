const mongoose = require('mongoose');

//
// Order Item Schema
//
const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductListing', required: true },
  qty: { type: Number, required: true, min: 1 },
  priceAtOrder: { type: Number, required: true, min: 0 },

  itemStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'ready', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  }
}, { _id: false });

//
// Sub-Order Schema (per farmer + location)
//
const SubOrderSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  deliveryMethod: { type: String, enum: ['pickup', 'thirdParty'], required: true },

  pickupInfo: {
    timeSlot: Date,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], index: '2dsphere' }  // [lng, lat]
    }
  },

  thirdPartyInfo: {
    partnerOrderId: String,
    eta: Date,
    cost: Number
  },

  items: { type: [OrderItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'rejected',
      'ready',
      'in_transit',
      'delivered',
      'cancelled',
      'in_progress',
      'partially_delivered'
    ],
    default: 'pending'
  }

}, { _id: true });

//
// Parent Order Schema
//
const OrderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 🔹 snapshot billing info from buyer at time of checkout
  billing: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    country: String
  },

  subOrders: { type: [SubOrderSchema], required: true },

  grandTotal: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: ['pending', 'in_progress', 'partially_delivered', 'delivered', 'cancelled'],
    default: 'pending'
  },

  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });


//
// 🔹 Derived Global Status
//
OrderSchema.methods.updateDerivedStatus = function () {
  const subStatuses = this.subOrders.map(s => s.status);

  if (subStatuses.every(s => s === 'delivered')) {
    this.status = 'delivered';
  } else if (subStatuses.some(s => ['ready', 'in_transit', 'delivered'].includes(s))) {
    this.status = 'partially_delivered';
  } else if (subStatuses.every(s => s === 'cancelled')) {
    this.status = 'cancelled';
  } else if (subStatuses.some(s => ['accepted', 'ready', 'in_transit'].includes(s))) {
    this.status = 'in_progress';
  } else {
    this.status = 'pending';
  }
};

OrderSchema.pre('save', function (next) {
  this.updateDerivedStatus();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
