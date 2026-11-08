/** Folder names are stable platform labels, independent of AI/topic tags. */
export function platformFolder(pluginId: string): string {
  return ({ toutiao: "头条", wechat: "微信", zhihu: "知乎", x: "X", instagram: "Instagram" } as Record<string, string>)[pluginId] ?? "网页";
}

export function collectionPrefix(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string): string => parts.find(p => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}${value("minute")}${value("second")}`;
}
