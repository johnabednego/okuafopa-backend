const mongoose = require('mongoose');

const ProductCategorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    trim: true,
    index: true,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProductCategory', ProductCategorySchema);
