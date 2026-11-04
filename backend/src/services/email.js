import nodemailer from 'nodemailer';

function createTransporter() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL || !EMAIL_PASS) {
    const error = new Error('Email delivery is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL and EMAIL_PASS.');
    error.status = 503;
    throw error;
  }
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT),
    secure: Number(EMAIL_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user: EMAIL, pass: EMAIL_PASS },
  });
}

export async function sendOtpEmail({ to, name, otp, purpose }) {
  const transporter = createTransporter();
  const isVerification = purpose === 'verification';
  const appName = 'Transly';
  const subject = isVerification
    ? `${appName} - Verify Your Email Address`
    : `${appName} - Password Reset Request`;
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);
  const heading = isVerification ? 'Verify your email address' : 'Password reset request';
  const explanation = isVerification
    ? 'Hello, thank you for registering with us. Enter the verification code below to confirm your email address and finish setting up your Transly account.'
    : 'We received a request to reset the password for your Transly account. Enter the code below to continue.';
  const text = `Hello ${name || 'there'},\n\n${explanation}\n\nYour one-time code: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this code, please ignore this email.\n\n© ${appName}. All rights reserved.`;
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${heading}</title></head>
  <body style="margin:0;padding:0;background-color:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#202923;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f6f4;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e3ebe5;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;background-color:#238b4b;color:#ffffff;font-size:21px;font-weight:bold;letter-spacing:0.2px;">${appName}</td></tr>
          <tr><td style="padding:32px 32px 12px;font-size:22px;line-height:1.35;font-weight:bold;color:#202923;">${heading}</td></tr>
          <tr><td style="padding:0 32px 22px;font-size:15px;line-height:1.65;color:#526158;">Hello ${safeName},<br>${explanation}</td></tr>
          <tr><td align="center" style="padding:0 32px 22px;">
            <div style="display:inline-block;padding:15px 24px;border:1px solid #d7e8db;border-radius:8px;background-color:#f1f8f2;color:#207a40;font-size:30px;line-height:1.2;font-weight:bold;letter-spacing:8px;">${safeOtp}</div>
          </td></tr>
          <tr><td align="center" style="padding:0 32px 10px;font-size:14px;line-height:1.5;color:#526158;">This code will expire in <strong>10 minutes</strong>.</td></tr>
          <tr><td style="padding:12px 32px 30px;font-size:13px;line-height:1.6;color:#68756c;">If you did not request this code, please ignore this email. Your account will remain unchanged.</td></tr>
          <tr><td align="center" style="padding:18px 24px;border-top:1px solid #e8eee9;font-size:12px;line-height:1.5;color:#849087;">&copy; ${appName}. All rights reserved.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  await transporter.sendMail({
    from: process.env.EMAIL,
    to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
