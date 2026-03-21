import { createRouter } from "@sarthakdev143/router";
import { createSignal, h, mount } from "@sarthakdev143/shadejs";

import { About } from "./about";
import { Feed } from "./feed";
import "./styles.css";
import { ThemeProvider, type ThemeMode } from "./theme";

const app = document.querySelector("#app");

if (!(app instanceof Element)) {
  throw new Error("ShadeJS demo root element was not found.");
}

const Router = createRouter([
  { component: Feed, path: "/" },
  { component: About, path: "/about" }
]);

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
    h(Router, null)
  );
}

mount(App, app);
