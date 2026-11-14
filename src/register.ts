// loads every seat's *.register.ts at startup, so plugging in a rule, scene or station never means editing main.ts
import.meta.glob("./**/*.register.ts", { eager: true });
