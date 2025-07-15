const mongoose = require('mongoose');
const User        = require('../models/User');
const Product     = require('../models/Product');
const Order       = require('../models/Order');
const Feedback    = require('../models/Feedback');

exports.getDashboardMetrics = async (req, res, next) => {
  try {
    // 1) Users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // 2) Product overview
    const [ totalProducts, activeProducts ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true })
    ]);

    // 3) Orders by status and total count
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const totalOrders = ordersByStatus.reduce((sum, o) => sum + o.count, 0);

    // 4) Total revenue (sum of order subtotals)
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['delivered','in_transit','ready'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$subtotal' } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // 5) Monthly sales (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    const monthlySales = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ['delivered'] } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$subtotal' },
          orders:  { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 6) Top‑selling products (by total quantity sold)
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQty: { $sum: '$items.qty' },
          totalSales: { $sum: { $multiply: ['$items.qty', '$items.priceAtOrder'] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          title: '$product.title',
          totalQty: 1,
          totalSales: 1
        }
      }
    ]);

    // 7) Average rating across all feedback
    const avgRatingRes = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalFeedback: { $sum: 1 } } }
    ]);
    const avgRating = avgRatingRes[0]?.avgRating || 0;
    const totalFeedback = avgRatingRes[0]?.totalFeedback || 0;

    res.json({
      usersByRole,
      products: { total: totalProducts, active: activeProducts },
      orders: { total: totalOrders, byStatus: ordersByStatus },
      revenue: { total: totalRevenue, monthly: monthlySales },
      topProducts,
      feedback: { total: totalFeedback, averageRating: avgRating }
    });
  } catch (err) {
    next(err);
  }
};
