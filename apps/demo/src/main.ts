import { mount } from "@shadowjs/runtime";

import { Feed } from "./feed";
import "./styles.css";

const app = document.querySelector("#app");

if (!(app instanceof Element)) {
  throw new Error("ShadowJS demo root element was not found.");
}

mount(Feed, app);
