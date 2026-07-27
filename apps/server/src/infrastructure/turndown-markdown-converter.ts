import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import type { MarkdownConverter } from "../domain/clip.js";

export class TurndownMarkdownConverter implements MarkdownConverter {
  private readonly service: TurndownService;

  constructor() {
    this.service = new TurndownService({
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      headingStyle: "atx",
    });
    this.service.use(gfm);
    this.service.addRule("obsidian-local-image", {
      filter: (node) => (
        node.nodeName === "IMG"
        && node.hasAttribute("data-l2o-local-path")
      ),
      replacement: (_content, node) => {
        const path = node.getAttribute("data-l2o-local-path");
        return path ? `![[${path}]]` : "";
      },
    });
  }

  convert(html: string): string {
    return this.service.turndown(html).trim();
  }
}

