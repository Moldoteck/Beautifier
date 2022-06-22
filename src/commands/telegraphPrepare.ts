//nm=hostname
const util = require("util");
import { URL } from "url";
const MAX_TELEGRAPH_LENGTH = 60000;

export function splitArray(articleArray: Array<Object>, link: string) {
  let articleParts = [];
  let subArticleArray = [];

  articleArray = articleArray.filter((item) => {
    return encodeJSON(item).length < MAX_TELEGRAPH_LENGTH;
  });

  for (let i = 0; i < articleArray.length; i++) {
    subArticleArray.push(articleArray[i]);
    let dataLength = encodeJSON(subArticleArray).length;
    if (dataLength > MAX_TELEGRAPH_LENGTH) {
      subArticleArray.pop();
      i--;

      //if non-empty, save
      if (subArticleArray.length != 0) {
        articleParts.push(subArticleArray);
        subArticleArray = [];
      }
    }
  }
  if (subArticleArray.length != 0) {
    articleParts.push(subArticleArray);
  }
  console.log(articleParts.length);
  //Add links to the original page and to the bot
  articleParts = articleParts.map((part) => addBotLink(addLinks(part, link)));

  return articleParts;
}

function addLinks(articleArray: any[], url: string) {
  let url_obj = new URL(url);
  let hostname: string = url_obj.hostname;
  articleArray.unshift({ tag: "br" });
  articleArray.unshift({
    tag: "a",
    attrs: { href: "https://" + hostname },
    children: [hostname],
  });
  articleArray.unshift(` from `);
  articleArray.unshift({
    tag: "a",
    attrs: { href: url },
    children: ["Original link"],
  });
  return articleArray;
}

function addBotLink(articleArray: any[]) {
  articleArray.unshift({ tag: "br" });
  articleArray.unshift({ tag: "br" });
  articleArray.unshift({
    tag: "a",
    attrs: { href: "https://t.me/BeautifierSimplifierBot" },
    children: ["Made with Beautifier"],
  });
  return articleArray;
}

function encodeJSON(obj: any) {
  let text_encoder = new util.TextEncoder();
  return text_encoder.encode(JSON.stringify(obj));
}

export async function createPages(
  article_parts: Array<Object>,
  token: string,
  title: string,
  ph: any
): Promise<Array<string>> {
  let pg = undefined;
  let parts_url = [];
  for (let art_i = 0; art_i < article_parts.length; ++art_i) {
    let part = article_parts[art_i];

    pg = await ph.createPage(token, title, part, {
      return_content: true,
    });
    parts_url.push(pg.url);
  }
  return parts_url;
}

export async function addPrevNext(
  parts_url: Array<string>,
  token: string,
  title: string,
  ph: any
) {
  for (let art_i = 0; art_i < parts_url.length; ++art_i) {
    let url = parts_url[art_i];
    let old_page = await ph.getPage(url.split("/").slice(-1)[0], {
      return_content: true,
    });
    let content = old_page.content;

    if (art_i < parts_url.length - 1) {
      content.unshift({ tag: "br" });
      content.unshift({
        tag: "h3",
        children: [
          {
            tag: "a",
            attrs: { href: `${parts_url[art_i + 1]}` },
            children: [`Next part ${art_i + 1}`],
          },
        ],
      });
    }
    if (art_i > 0) {
      content.unshift({
        tag: "h3",
        children: [
          {
            tag: "a",
            attrs: { href: `${parts_url[art_i - 1]}` },
            children: [`Prev part ${art_i - 1}`],
          },
        ],
      });
    }

    if (art_i > 0) {
      content.push({
        tag: "h3",
        children: [
          {
            tag: "a",
            attrs: { href: `${parts_url[art_i - 1]}` },
            children: [`Prev part ${art_i - 1}`],
          },
        ],
      });
    }
    if (art_i < parts_url.length - 1) {
      content.push({
        tag: "h3",
        children: [
          {
            tag: "a",
            attrs: { href: `${parts_url[art_i + 1]}` },
            children: [`Next part ${art_i + 1}`],
          },
        ],
      });
      content.push({ tag: "br" });
    }
    await ph.editPage(token, url.split("/").slice(-1)[0], title, content, {
      return_content: true,
    });
  }
}
