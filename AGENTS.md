<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Sign-in is phone + WhatsApp one-time code only (`src/lib/phone-auth.functions.ts`, codes hashed in `login_otps`, session via admin magiclink token_hash); only numbers already in profiles/contacts/service_partners can sign in. Why: the client wants no passwords.
- Scheduled jobs piggyback on the hourly `/api/public/n8n` GET; biweekly jobs use a 13-day `acquire_automation_lease` as the "once per 14 days" guard.
