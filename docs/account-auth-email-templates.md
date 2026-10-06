# FCMobiletools Auth Email Templates

These templates are designed for the hosted Supabase Authentication > Email Templates editor.

## Confirm signup

Subject:
`Confirm your FCMobiletools account`

HTML:
```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#071018;color:#f5f8fb;font-family:Inter,Arial,sans-serif">
    <div style="max-width:620px;margin:0 auto;padding:44px 18px">
      <div style="background:#0f1a26;border:1px solid rgba(255,255,255,.09);border-radius:24px;overflow:hidden">
        <div style="padding:28px 30px;border-bottom:1px solid rgba(255,255,255,.07)">
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#4cc9ff">FCMOBILETOOLS ACCOUNT</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.08">Confirm your email</h1>
        </div>
        <div style="padding:30px">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#d7e4eb">Thanks for creating your FCMobiletools account.</p>
          <p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:#9fb1bd">Confirm your email address to activate your account and unlock account-only progression features.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 20px;border-radius:12px;background:#4cc9ff;color:#04131c;text-decoration:none;font-weight:800">Confirm email address</a>
          <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#718594">This verification link can only be used once. If it has expired, return to FCMobiletools and request a fresh verification email.</p>
        </div>
      </div>
      <p style="margin:18px 4px 0;text-align:center;font-size:11px;color:#5f7382">FCMobiletools · Everything useful starts here.</p>
    </div>
  </body>
</html>
```

## Reset password

Subject:
`Reset your FCMobiletools password`

HTML:
```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#071018;color:#f5f8fb;font-family:Inter,Arial,sans-serif">
    <div style="max-width:620px;margin:0 auto;padding:44px 18px">
      <div style="background:#0f1a26;border:1px solid rgba(255,255,255,.09);border-radius:24px;overflow:hidden">
        <div style="padding:28px 30px;border-bottom:1px solid rgba(255,255,255,.07)">
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#4cc9ff">FCMOBILETOOLS ACCOUNT</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.08">Reset your password</h1>
        </div>
        <div style="padding:30px">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#d7e4eb">We received a password reset request for your FCMobiletools account.</p>
          <p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:#9fb1bd">Use the button below to choose a new password. If you did not request this, you can safely ignore this email.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 20px;border-radius:12px;background:#4cc9ff;color:#04131c;text-decoration:none;font-weight:800">Reset password</a>
          <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#718594">For your security, the reset link is single-use and expires automatically.</p>
        </div>
      </div>
      <p style="margin:18px 4px 0;text-align:center;font-size:11px;color:#5f7382">FCMobiletools · Account Security</p>
    </div>
  </body>
</html>
```

For production, keep the Supabase Site URL set to `https://fcmobiletools.online` and allow `https://fcmobiletools.online/account/` as an Auth redirect URL.
