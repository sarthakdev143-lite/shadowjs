import { mount } from "murkjs";

import { Feed } from "./feed";
import "./styles.css";

const app = document.querySelector("#app");

if (!(app instanceof Element)) {
  throw new Error("MurkJS demo root element was not found.");
}

mount(Feed, app);
