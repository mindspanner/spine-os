# SOP — Client intake (how a new client enters the system)

- **When to run this:** the moment a new client says yes, or sends a signed engagement / first deposit. Run it before you do any billable work for them.
- **Owner:** you
- **Last reviewed:** YYYY-MM-DD

## Purpose

Turn a "new client" from a loose collection of emails, a quote and a phone call into one tidy, findable home on your own disk — so nothing about that engagement ever lives only in your head or only in someone else's inbox.

## Inputs

- The agreement / quote / proposal the client accepted.
- Their contact details and preferred channel.
- Any files they have already sent you.

## Outputs

- One client folder under `30-CLIENTS/` created from `_TEMPLATE.md`.
- One project folder under `10-PROJECTS/` for the work itself (if it is a project, not just an ongoing relationship).
- A one-line entry in your decisions log if anything non-obvious was agreed (scope, price exception, data handling).

## Steps

1. **Copy the template.** Duplicate `30-CLIENTS/_TEMPLATE.md` to `30-CLIENTS/<Client-Name>.md`. Use a stable, human-readable name — the business or person you invoice, not a nickname.
2. **Fill the header.** Set `Since`, `Status: active`, and the `Primary contact` (name + the channel you will actually use — email, phone, a messaging app).
3. **Record the engagement basics.** Under Matters, write the first matter as one line: `<what you're doing> — active — <next action>`. Keep the agreement itself (PDF or email) in the client folder, not in your downloads.
4. **Decide data handling once.** Note where this client's information is allowed to live (this vault only, or a named tool). If it is anything other than "local only", that is a decision — write an ADR (`SOP` below points to the template).
5. **Open the project, if applicable.** If the work has a start and an end, copy `10-PROJECTS/_TEMPLATE.md` and link it from the client note. Ongoing retainers can stay as a matter on the client note.
6. **Set the very next action.** One physical next step (e.g. "send onboarding questionnaire"). If you can't name one, the engagement isn't really open yet.
7. **Capture, don't tidy.** Anything you can't file in two minutes goes to `00-INBOX/` to be sorted in your weekly review. Do not let "I'll organise it later" mean "it lives in my email forever".

## Done when

There is exactly one folder per client under `30-CLIENTS/`, it names a single next action, and you could hand the folder to a stand-in and they'd know what's going on.

## Worked example

A solo bookkeeper signs "Riverside Cafe" for monthly accounts.

1. Copies `_TEMPLATE.md` → `30-CLIENTS/Riverside-Cafe.md`.
2. Header: `Since: 2026-03-02 · Status: active · Primary contact: Sam Nguyen · email`.
3. Matter line: `Monthly BAS + bookkeeping — active — request March receipts`.
4. Data handling: "Local vault + my accounting software only. No client files emailed to third parties." (Routine, no ADR needed.)
5. Ongoing retainer, so no separate project folder — the matter lives on the client note.
6. Next action: `request March receipts`.
7. The two stray emails with their ABN and bank details go to `00-INBOX/` to be filed Friday.

> This is an admin procedure, not advice. If you handle health, financial or other sensitive
> information, align this SOP with the privacy and professional obligations that apply to you.
