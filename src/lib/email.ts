// Pluggable email service.
//
// The original system used Google Apps Script's MailApp to send notifications.
// Locally we don't want to send real mail, so by default every message is
// logged to the server console. If SMTP_* env vars are filled in, you can wire
// up nodemailer here without touching any callers.

type MailInput = {
  to: string;
  subject: string;
  body: string;
};

const smtpConfigured = !!process.env.SMTP_HOST;

export async function sendMail({ to, subject, body }: MailInput): Promise<void> {
  if (!to) return;

  if (!smtpConfigured) {
    // Local/dev mode: log instead of send.
    console.log(
      "\n📧 [MAIL — local log mode, not actually sent]\n" +
        `   To: ${to}\n` +
        `   Subject: ${subject}\n` +
        "   ----\n" +
        body
          .split("\n")
          .map((l) => "   " + l)
          .join("\n") +
        "\n"
    );
    return;
  }

  // To send for real, install nodemailer and uncomment:
  //
  // const nodemailer = await import("nodemailer");
  // const transport = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT || 587),
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text: body });
  console.log(`📧 [MAIL] (SMTP configured) would send "${subject}" to ${to}`);
}

export function isEmail(v: unknown): boolean {
  return typeof v === "string" && /.+@.+\..+/.test(v);
}
