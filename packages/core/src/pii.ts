/**
 * Remove personal data before text leaves the device.
 * Keeps domains (needed to judge a scam), drops names in addresses, paths and query strings.
 * Names written in the body are not detected; the UI says so.
 */
export function scrubPii(input: string): string {
  return input
    .replace(/https?:\/\/([a-z0-9.-]+)[^\s)>\]]*/gi, (_m, host: string) => `[link:${host.toLowerCase()}]`)
    .replace(/[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi, (_m, d: string) => `[email]@${d.toLowerCase()}`)
    .replace(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi, "[upi]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card]")
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[aadhaar]")
    .replace(/(?:\+?91[ -]?)?\b[6-9]\d{4}[ -]?\d{5}\b/g, "[phone]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[pan]");
}

const NOT_NAMES = new Set(["creator", "creators", "influencer", "friend", "team", "there", "all", "everyone", "sir", "madam", "regards", "thanks", "best"]);
const NAME = "[A-Z][a-z]{1,20}(?:[ \\t][A-Z][a-z]{1,20})?";
const isGeneric = (n: string) => NOT_NAMES.has(n.split(/\s/)[0]?.toLowerCase() ?? "");

/**
 * Best-effort removal of personal names. Regex only, linear time, safe to run in the popup.
 * Removes: display names in From/Reply-To/To lines, greeting names, the name after a sign-off,
 * "I'm / My name is" introductions and @handles. Company names are kept.
 */
export function scrubNames(input: string): string {
  return input
    .replace(/^((?:from|reply-to|to|cc):[ \t]*)(?:"?[^<\n"]{1,60}"?)[ \t]*(<[^>\n]+>)/gim, "$1[name] $2")
    .replace(new RegExp(`\\b(Hi|Hello|Dear|Hey)[ \\t]+(${NAME})(?=[,!.\\s]|$)`, "g"), (m, g: string, n: string) => (isGeneric(n) ? m : `${g} [name]`))
    .replace(new RegExp(`\\b((?:Warm |Best |Kind )?(?:Regards|Thanks|Thank you|Best|Cheers|Sincerely)[,!.]?[ \\t]*\\r?\\n[ \\t]*)(${NAME})`, "g"), "$1[name]")
    .replace(new RegExp(`\\b(I'm|I am|This is|My name is)[ \\t]+(${NAME})(?![a-z])`, "g"), (m, g: string, n: string) => (isGeneric(n) ? m : `${g} [name]`))
    .replace(/(?<![\w.%+\]-])@[A-Za-z0-9_.]{2,30}\b/g, "[handle]");
}
