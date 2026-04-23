import {getRequestConfig} from "next-intl/server";
import {cookies} from "next/headers";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "fr";
  const validLocales = ["fr", "en"];
  const resolvedLocale = validLocales.includes(locale) ? locale : "fr";
  const componentMessages = (await import(`../app/components/${resolvedLocale}.json`)).default;
  const chatMessages = (await import(`../app/chat/${resolvedLocale}.json`)).default;

  return {
    locale: resolvedLocale,
    messages: {
      ...componentMessages,
      ...chatMessages,
    },
  };
});
