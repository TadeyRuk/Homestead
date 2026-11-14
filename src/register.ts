// loads every seat's *.register.ts at startup, so plugging in a rule, scene or station never means editing main.ts
const modules = import.meta.glob("./**/*.register.ts", { eager: true });
// a misnamed file just never loads, so list what did load while developing
if (import.meta.env.DEV) console.info(`registered: ${Object.keys(modules).join(", ")}`);
