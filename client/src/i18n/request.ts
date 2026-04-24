import {getRequestConfig} from "next-intl/server";

export default getRequestConfig(async () => {
  const resolvedLocale = "fr";
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
