import { createSignal, h, mount } from "@sarthakdev143/shadejs";

import { Feed } from "./feed";
import "./styles.css";
import { ThemeProvider, type ThemeMode } from "./theme";

const app = document.querySelector("#app");

if (!(app instanceof Element)) {
  throw new Error("ShadeJS demo root element was not found.");
}

function App() {
  const [theme, setTheme] = createSignal<ThemeMode>("dark");

  return h(
    ThemeProvider,
    {
      value: {
        theme,
        toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
      }
    },
    h(Feed, null)
  );
}

mount(App, app);
