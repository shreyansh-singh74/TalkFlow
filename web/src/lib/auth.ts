import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import nodemailer from "nodemailer";

// Normalize baseURL - remove trailing slash and /api/auth if present
const rawBaseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BETTER_AUTH_URL || '';
const baseURL = rawBaseURL.replace(/\/$/, '').replace(/\/api\/auth$/, '');

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const auth = betterAuth({
  baseURL: baseURL || undefined,
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({user, url}) => {
      // Send email via SMTP
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await transporter.sendMail({
            from: `"TalkFlow" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: "Reset Your Password - TalkFlow",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      margin: 0;
                      padding: 0;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                      line-height: 1.6;
                      color: #000000;
                      background-color: #f5f5f5;
                    }
                    .container {
                      max-width: 560px;
                      margin: 40px auto;
                      background: #ffffff;
                      border-radius: 8px;
                      overflow: hidden;
                    }
                    .header {
                      padding: 32px 40px 24px;
                      border-bottom: 1px solid #e5e5e5;
                    }
                    .brand {
                      font-size: 20px;
                      font-weight: 600;
                      color: #18a44b;
                      margin: 0;
                      letter-spacing: -0.02em;
                    }
                    .content {
                      padding: 32px 40px;
                    }
                    .title {
                      font-size: 18px;
                      font-weight: 600;
                      color: #000000;
                      margin: 0 0 16px 0;
                    }
                    .text {
                      font-size: 14px;
                      color: #000000;
                      margin: 0 0 16px 0;
                    }
                    .button {
                      display: inline-block;
                      background: #18a44b;
                      color: #ffffff;
                      padding: 12px 24px;
                      text-decoration: none;
                      border-radius: 6px;
                      font-size: 14px;
                      font-weight: 500;
                      margin: 8px 0 24px 0;
                    }
                    .link-container {
                      background: #fafafa;
                      padding: 12px;
                      border-radius: 6px;
                      margin: 16px 0;
                      word-break: break-all;
                      font-size: 13px;
                      color: #000000;
                    }
                    .expiry {
                      font-size: 13px;
                      color: #000000;
                      margin: 16px 0;
                    }
                    .footer {
                      padding: 24px 40px;
                      border-top: 1px solid #e5e5e5;
                      text-align: center;
                    }
                    .footer-text {
                      font-size: 12px;
                      color: #a3a3a3;
                      margin: 0;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <p class="brand">TalkFlow</p>
                    </div>
                    <div class="content">
                      <h1 class="title">Reset your password</h1>
                      <p class="text">Hi${user.name ? ' ' + user.name : ''},</p>
                      <p class="text">We received a request to reset your password for your TalkFlow account. Click the button below to create a new password:</p>
                      <a href="${url}" class="button" style="color: #ffffff;">Reset Password</a>
                      <p class="text">Or copy and paste this link into your browser:</p>
                      <div class="link-container">${url}</div>
                      <p class="expiry">This link will expire in 1 hour.</p>
                      <p class="text">If you didn't request a password reset, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                      <p class="footer-text">© 2025 TalkFlow. All rights reserved.</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
            text: `Hi ${user.name || 'there'},\n\nWe received a request to reset your password for your TalkFlow account.\n\nClick the link below to reset your password:\n${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, please ignore this email.\n\nBest regards,\nThe TalkFlow Team`,
          });
          console.info("Password reset email sent", { email: user.email });
        } catch (error) {
          console.error("Failed to send password reset email", {
            email: user.email,
            error,
          });
          throw error; // Re-throw to let Better-Auth handle it
        }
      } else {
        console.warn("SMTP credentials not configured. Password reset email not sent.");
      }
    },
  },
});
