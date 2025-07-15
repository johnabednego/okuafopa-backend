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

const platformName = 'SprintSync';

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
exports.sendProductNotification = async (type, product, recipient) => {
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
      intro   = 'Your new product listing has been published successfully.';
      break;
    case 'updated':
      subject = `Your product "${title}" has been updated`;
      intro   = 'Your product listing details have been updated.';
      break;
    case 'deleted':
      subject = `Your product "${title}" has been removed`;
      intro   = 'Your product listing was deleted from the marketplace.';
      break;
    default:
      subject = `Notification about your product "${title}"`;
      intro   = '';
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
