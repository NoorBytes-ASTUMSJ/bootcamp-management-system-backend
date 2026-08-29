const nodemailer = require("nodemailer");

const sendOTPEmail = async (toEmail, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Port 465 SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"ASTU MSJ Bootcamp" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Verification Code (OTP)",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #B91C1C; text-align: center; margin-bottom: 8px;">ASTU MSJ Bootcamp</h2>
        <p style="color: #334155; font-size: 14px;">You requested to reset your password. Use the 6-digit verification code below to complete the process:</p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background-color: #FEF2F2; color: #B91C1C; padding: 12px 28px; border-radius: 10px; border: 1.5px dashed #B91C1C; display: inline-block;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please safely ignore this email.</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
