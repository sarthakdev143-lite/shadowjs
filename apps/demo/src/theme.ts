import { createContext, createProvider, type Accessor } from "@sarthakdev143/shadejs";

export type ThemeMode = "dark" | "light";

export interface ThemeContextValue {
  theme: Accessor<ThemeMode>;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: () => "dark",
  toggleTheme: () => {}
});

export const ThemeProvider = createProvider(ThemeContext);
