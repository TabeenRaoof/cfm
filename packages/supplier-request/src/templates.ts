/**
 * EN/ZH templates for the supplier request email and its reminders (`02-` §10.1 week 7).
 * Plain string interpolation — a supplier request has a small, fixed set of facts to convey
 * (who's asking, what for, by when, the link), so a model has nothing to add here and every
 * render costs zero tokens. Chinese was named explicitly in the plan (line 40, line 319) because
 * a meaningful share of sellers' suppliers are China-based factories.
 */

export type SupplierRequestLocale = "en" | "zh";

export interface RenderedEmail {
  readonly subject: string;
  readonly body: string;
}

export interface SupplierRequestEmailParams {
  readonly requesterOrganisationName: string;
  readonly supplierContactName: string | null;
  readonly requestedItemLabels: readonly string[];
  readonly dueAtDate: string; // ISO date, e.g. "2026-10-15" — formatted per locale below
  readonly magicLinkUrl: string;
  /** null on the first send; the reminder count (1-based) on a reminder. */
  readonly reminderNumber: number | null;
  /**
   * True on the last reminder the schedule sends (1 day before `dueAt` — see
   * `REMINDER_OFFSETS_DAYS` in reminders.ts). Ignored when `reminderNumber` is null. Without
   * this, the week-out nudge and the day-before deadline read identically ("Reminder: ...") —
   * which understates exactly the message that most needs the supplier's attention. The caller
   * derives it by comparing the index `dueReminder` returned to `REMINDER_OFFSETS_DAYS.length -
   * 1`, rather than this module importing reminders.ts and coupling two otherwise-independent
   * pure modules.
   */
  readonly isFinalReminder?: boolean;
}

function formatDate(iso: string, locale: SupplierRequestLocale): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) throw new Error(`dueAtDate must be an ISO date (YYYY-MM-DD), got "${iso}".`);
  return locale === "zh" ? `${year}年${Number(month)}月${Number(day)}日` : `${Number(day)} ${MONTHS_EN[Number(month) - 1]} ${year}`;
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function greeting(name: string | null, locale: SupplierRequestLocale): string {
  if (locale === "zh") return name ? `${name}，您好：` : "您好：";
  return name ? `Hi ${name},` : "Hello,";
}

function itemList(labels: readonly string[], locale: SupplierRequestLocale): string {
  return labels.map((label) => (locale === "zh" ? `- ${label}` : `- ${label}`)).join("\n");
}

export function renderSupplierRequestEmail(
  locale: SupplierRequestLocale,
  params: SupplierRequestEmailParams,
): RenderedEmail {
  const dueDate = formatDate(params.dueAtDate, locale);
  const items = itemList(params.requestedItemLabels, locale);
  const isReminder = params.reminderNumber !== null;
  const isFinal = isReminder && params.isFinalReminder === true;

  if (locale === "zh") {
    const subject = isFinal
      ? `【最后提醒】${params.requesterOrganisationName} 仍需您的合规文件 —— 明天截止（${dueDate}）`
      : isReminder
        ? `【提醒】${params.requesterOrganisationName} 需要您提供合规文件（截止 ${dueDate}）`
        : `${params.requesterOrganisationName} 需要您提供合规文件`;
    const body = [
      greeting(params.supplierContactName, locale),
      "",
      isFinal
        ? `这是最后一次提醒：${params.requesterOrganisationName} 明天（${dueDate}）截止前仍在等待以下文件：`
        : isReminder
          ? `提醒您，${params.requesterOrganisationName} 仍在等待以下文件：`
          : `${params.requesterOrganisationName} 需要以下文件，以完成产品合规审核：`,
      "",
      items,
      "",
      `请截止 ${dueDate} 前通过以下链接上传，无需注册账号：`,
      params.magicLinkUrl,
      "",
      "感谢您的配合。",
    ].join("\n");
    return { subject, body };
  }

  const subject = isFinal
    ? `Final reminder: ${params.requesterOrganisationName} still needs your compliance documents — due tomorrow (${dueDate})`
    : isReminder
      ? `Reminder: ${params.requesterOrganisationName} still needs your compliance documents (due ${dueDate})`
      : `${params.requesterOrganisationName} needs your compliance documents`;
  const body = [
    greeting(params.supplierContactName, locale),
    "",
    isFinal
      ? `This is a final reminder: ${params.requesterOrganisationName} is still waiting on the following, due tomorrow (${dueDate}):`
      : isReminder
        ? `This is a reminder that ${params.requesterOrganisationName} is still waiting on:`
        : `${params.requesterOrganisationName} needs the following to complete a product compliance review:`,
    "",
    items,
    "",
    `Please upload these by ${dueDate} using the link below. No account is needed:`,
    params.magicLinkUrl,
    "",
    "Thank you for your help.",
  ].join("\n");
  return { subject, body };
}
