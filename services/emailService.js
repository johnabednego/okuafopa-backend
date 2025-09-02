const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  throw new Error('SMTP configuration is incomplete.');
}

const platformName = 'Okuafopa';

/**
 * Send a otp-related  email.
 * 
 * */

exports.sendOTP = async (to, otp, emailPurpose) => {

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f7f7f7; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      <h2 style="color: #2c3e50;">Welcome to ${platformName}</h2>
      <p style="font-size: 16px; color: #333;">Hello,</p>
      <p style="font-size: 16px; color: #333;">
        Your One-Time Password (OTP) is:
        <strong style="display: block; font-size: 24px; color: #27ae60; margin: 10px 0;">${otp}</strong>
      </p>
      <p style="font-size: 14px; color: #666;">
        This code will expire in 10 minutes. If you did not request this, please ignore this email.
      </p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        &copy; ${new Date().getFullYear()} ${platformName}. All rights reserved.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${platformName} - ${emailPurpose} OTP`,
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html
  });
};


/**
 * Send a product-related notification email.
 *
 * @param {'created'|'updated'|'deleted'} type
 * @param {object} product     – populated Product document
 * @param {object} recipient   – { email, firstName, lastName }
 */
exports.sendProductListingNotification = async (type, product, recipient) => {
  const {
    title,
    description,
    price,
    quantity,
    category,
    createdAt,
    updatedAt
  } = product;

  const fullName = `${recipient.firstName} ${recipient.lastName}`;
  let subject, intro;

  switch (type) {
    case 'created':
      subject = `Your product "${title}" is now live!`;
      intro = 'Your new product listing has been published successfully.';
      break;
    case 'updated':
      subject = `Your product "${title}" has been updated`;
      intro = 'Your product listing details have been updated.';
      break;
    case 'deleted':
      subject = `Your product "${title}" has been removed`;
      intro = 'Your product listing was deleted from the marketplace.';
      break;
    default:
      subject = `Notification about your product "${title}"`;
      intro = '';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; background:#f7f7f7; border-radius:8px;">
      <h2 style="color:#2c3e50;">${subject}</h2>
      <p>Hi ${fullName},</p>
      <p>${intro}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Title</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${title}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Description</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${description || '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Category</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${category}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Price</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">\$${price.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Quantity</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${quantity}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Last Updated</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${new Date(updatedAt).toLocaleString()}</td>
        </tr>
      </table>
      <p style="font-size:12px; color:#999; margin-top:30px;">&copy; ${new Date().getFullYear()} ${platformName}. All rights reserved.</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: recipient.email,
    subject,
    html
  });
};

/**
 * Send an order-related notification email.
 *
 * @param {'created'|'statusChanged'} type
 * @param {object} order        – populated Order document (with items and buyer/product populated as needed)
 * @param {object} recipient    – { email, firstName, lastName }
 */
exports.sendOrderNotification = async (type, order, recipient) => {
  const {
    _id,
    subtotal,
    status,
    deliveryMethod,
    pickupInfo,
    thirdPartyInfo,
    createdAt,
    updatedAt
  } = order;

  console.log("DEBUG order:", JSON.stringify(order, null, 2));

  const fullName = `${recipient.firstName} ${recipient.lastName}`;
  let subject, intro;

  switch (type) {
    case 'created':
      subject = `Your order ${_id} has been placed`;
      intro = 'Thank you for your purchase! Your order details are below:';
      break;
    case 'statusChanged':
      subject = `Order ${_id} status updated to "${status}"`;
      intro = `The status of your order has changed to "${status}".`;
      break;
    default:
      subject = `Update on your order ${_id}`;
      intro = '';
  }

  // Flatten all items across subOrders
  const allItems = (order.subOrders || []).flatMap(so => so.items || []);

  const rowsHtml = allItems.map(it => {
    const title = it?.product?.title || "Unnamed product";
    const qty = typeof it?.qty === "number" ? it.qty : 0;

    // Safely resolve unit price
    const unitPrice = typeof it?.priceAtOrder === "number"
      ? it.priceAtOrder
      : (typeof it?.product?.price === "number" ? it.product.price : 0);

    const lineTotal = qty * unitPrice;

    return `
      <tr>
        <td style="padding:8px; border:1px solid #ddd;">${title}</td>
        <td style="padding:8px; border:1px solid #ddd; text-align:right;">${qty}</td>
        <td style="padding:8px; border:1px solid #ddd; text-align:right;">\$${unitPrice.toFixed(2)}</td>
        <td style="padding:8px; border:1px solid #ddd; text-align:right;">\$${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Delivery details
  let deliveryHtml = '';
  if (deliveryMethod === 'pickup' && pickupInfo) {
    deliveryHtml = `
      <tr><td colspan="4" style="padding:8px; border:1px solid #ddd;">
        <strong>Pickup Time:</strong> ${pickupInfo.timeSlot ? new Date(pickupInfo.timeSlot).toLocaleString() : 'N/A'}
      </td></tr>
      <tr><td colspan="4" style="padding:8px; border:1px solid #ddd;">
        <strong>Pickup Location:</strong> ${pickupInfo.location?.coordinates ? `[${pickupInfo.location.coordinates.join(', ')}]` : 'N/A'}
      </td></tr>
    `;
  } else if (deliveryMethod === 'thirdParty' && thirdPartyInfo) {
    deliveryHtml = `
      <tr><td colspan="4" style="padding:8px; border:1px solid #ddd;">
        <strong>Carrier ETA:</strong> ${thirdPartyInfo.eta ? new Date(thirdPartyInfo.eta).toLocaleString() : 'N/A'}
      </td></tr>
      <tr><td colspan="4" style="padding:8px; border:1px solid #ddd;">
        <strong>Shipping Cost:</strong> \$${typeof thirdPartyInfo.cost === "number" ? thirdPartyInfo.cost.toFixed(2) : '0.00'}
      </td></tr>
    `;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; background:#fff; border-radius:8px;">
      <h2 style="color:#2c3e50;">${subject}</h2>
      <p>Hi ${fullName},</p>
      <p>${intro}</p>

      <table style="width:100%; border-collapse:collapse; margin-top:20px;">
        <thead>
          <tr>
            <th style="padding:8px; border:1px solid #ddd; text-align:left;">Item</th>
            <th style="padding:8px; border:1px solid #ddd; text-align:right;">Qty</th>
            <th style="padding:8px; border:1px solid #ddd; text-align:right;">Unit Price</th>
            <th style="padding:8px; border:1px solid #ddd; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr>
            <td colspan="3" style="padding:8px; border:1px solid #ddd; text-align:right;"><strong>Subtotal</strong></td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">
              <strong>\$${typeof subtotal === "number" ? subtotal.toFixed(2) : "0.00"}</strong>
            </td>
          </tr>
          ${deliveryHtml}
          <tr>
            <td colspan="4" style="padding:8px; border:1px solid #ddd; text-align:right;">
              <em>Order placed: ${createdAt ? new Date(createdAt).toLocaleString() : "N/A"}</em>
            </td>
          </tr>
          <tr>
            <td colspan="4" style="padding:8px; border:1px solid #ddd; text-align:right;">
              <em>Last updated: ${updatedAt ? new Date(updatedAt).toLocaleString() : "N/A"}</em>
            </td>
          </tr>
        </tbody>
      </table>

      <p style="font-size:12px; color:#999; margin-top:30px;">&copy; ${new Date().getFullYear()} Okuafopa Marketplace</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: recipient.email,
    subject,
    html
  });
};


/**
 * Send an email notification for a new chat message.
 *
 * @param {object} message    – the newly-created Message doc (with at least .text, .order, .sender)
 * @param {object} recipient  – { email, firstName, lastName }
 */
exports.sendMessageNotification = async (message, recipient) => {
  // Grab a snippet of the message
  const snippet = message.text.length > 100
    ? message.text.slice(0, 100) + '…'
    : message.text;

  const fullName = `${recipient.firstName} ${recipient.lastName}`;
  const subject = `New message on order ${message.order}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; padding:20px; background:#f7f7f7; border-radius:8px;">
      <h2 style="color:#2c3e50;">New message in Okuafopa chat</h2>
      <p>Hi ${fullName},</p>
      <p>You have a new message on <strong>Order ID ${message.order}</strong>:</p>
      <blockquote style="border-left:4px solid #ccc; padding-left:10px; color:#555;">
        ${snippet}
      </blockquote>
      <p><a href="https://your-frontend.com/orders/${message.order}/chat">View the full conversation & reply</a></p>
      <hr style="margin-top:20px;" />
      <p style="font-size:12px; color:#999;">&copy; ${new Date().getFullYear()} Okuafopa Marketplace</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to: recipient.email,
    subject,
    html
  });
};


/**
 * Notify a farmer that they received new feedback.
 * @param {object} feedback  – the newly-created Feedback doc
 * @param {object} farmer    – { email, firstName, lastName }
 */
exports.sendFeedbackCreatedNotification = async (feedback, farmer) => {
  const fullName = `${farmer.firstName} ${farmer.lastName}`;
  const subject = `New feedback on Order ${feedback.order}`;
  const html = `
    <p>Hi ${fullName},</p>
    <p>You’ve received a new ${feedback.rating}‑star review:</p>
    <blockquote>${feedback.comment || '—'}</blockquote>
    <p><a href="https://your‑frontend.com/orders/${feedback.order}/feedback">View and reply</a></p>
  `;
  await transporter.sendMail({ from: SMTP_FROM, to: farmer.email, subject, html });
};

/**
 * Notify a buyer that their feedback got a response.
 * @param {object} feedback  – the updated Feedback doc (including .response)
 * @param {object} buyer     – { email, firstName, lastName }
 */
exports.sendFeedbackResponseNotification = async (feedback, buyer) => {
  const fullName = `${buyer.firstName} ${buyer.lastName}`;
  const subject = `Your feedback on Order ${feedback.order} has a reply`;
  const html = `
    <p>Hi ${fullName},</p>
    <p>Your review on order <strong>${feedback.order}</strong> just received a response:</p>
    <blockquote>${feedback.response.text}</blockquote>
    <p><a href="https://your‑frontend.com/orders/${feedback.order}/feedback">View the conversation</a></p>
  `;
  await transporter.sendMail({ from: SMTP_FROM, to: buyer.email, subject, html });
};
