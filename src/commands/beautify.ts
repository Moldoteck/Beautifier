import { iv_links } from "@/helpers/iv_links";
import { DocumentType } from "@typegoose/typegoose";

import { Telegraf, Context } from "telegraf";

const telegraph = require("telegraph-node");
import { URL } from "url";
const ndl = require("needle");
const cheerio = require("cheerio");

const { Readability, isProbablyReaderable } = require("@mozilla/readability");
var { JSDOM } = require("jsdom");
const jsdom = require("jsdom");

import {
  findArticle,
  createArticle,
  deleteArticle,
  deleteAllArticles,
  Article,
  findAllChats,
  deleteChat,
} from "../models";
import { countDocs } from "../models";
import { addPrevNext, createPages, splitArray } from "./telegraphPrepare";
import { detectURL, processURL } from "./urlprocessor";
import { Atransform } from "./contentTransformer";

export function setupBeautify(bot: Telegraf<Context>) {
  bot.command(["help", "start"], (ctx) => {
    ctx.replyWithHTML(ctx.i18n.t("help"));
  });
  bot.command("clear", async (ctx) => {
    let [urls, _] = detectURL(ctx.message.reply_to_message);
    urls.forEach(async (element) => {
      element = processURL(element);
      await deleteArticle(element);
    });

    await ctx.deleteMessage(ctx.message.message_id);
  });

  bot.command("countChats", async (ctx) => {
    if (ctx.message.from.id == 180001222) {
      let chats = await findAllChats();
      let users_tot = 0;
      let chat_nr = 0;
      let users_pr = 0;
      for (let element of chats) {
        try {
          let chatObj = await ctx.telegram.getChat(element.id);
          if (chatObj == undefined) {
            //delete chat from Chat db by id
            await deleteChat(element.id);
            continue;
          }

          if (chatObj.type == "private") {
            users_pr += 1;
          } else {
            chat_nr += 1;

            users_tot += await ctx.telegram.getChatMembersCount(element.id);
          }
        } catch (err) {
          console.log(err);
        }
      }
      ctx
        .reply(
          "Chat users " +
            users_tot +
            "\nPrivate Users " +
            users_pr +
            "\nChats " +
            chat_nr
        )
        .catch((err) => console.log(err));
    }
  });

  bot.command("countDocs", async (ctx) => {
    if (ctx.message.from.id == 180001222) {
      ctx.reply(" " + (await countDocs()));
    }
  });

  bot.command("clearAll", async (ctx) => {
    //TODO: owner id should be in env
    //TODO: move chat counting to another package
    if (ctx.message.from.id == 180001222) {
      await deleteAllArticles();
    }
    await ctx.deleteMessage(ctx.message.message_id);
  });

  bot.command("interactive", async (ctx) => {
    let chat = ctx.dbchat;
    chat.interactive = !chat.interactive;
    chat = await (chat as any).save();
    ctx.reply("ok");
  });

  bot.command("instant", async (ctx) => {
    if (
      "text" in ctx.message.reply_to_message ||
      "caption" in ctx.message.reply_to_message
    ) {
      let [detected_urls, url_place, url_type] = detectURL(
        ctx.message.reply_to_message
      );
      let final_urls = await messageProcessing(detected_urls, ctx);
      sendResponse(final_urls, url_place, url_type, ctx, true);
    }
  });

  bot.on(["text", "message"], async (ctx) => {
    if (ctx.dbchat.interactive || ctx.message.chat.type == "private") {
      if ("text" in ctx.message || "caption" in ctx.message) {
        let [detected_urls, url_place, url_type] = detectURL(ctx.message);

        let final_urls = await messageProcessing(detected_urls, ctx);

        sendResponse(final_urls, url_place, url_type, ctx);
      }
    }
  });
}

async function messageProcessing(detected_urls: any[], ctx: Context) {
  var final_urls = [];
  if (detected_urls.length > 0) {
    ctx.telegram.sendChatAction(ctx.chat.id, "typing");
  }
  for (let l_ind = 0; l_ind < detected_urls.length; ++l_ind) {
    let link = detected_urls[l_ind];

    link = processURL(link);
    let url_obj = new URL(link);
    let nm = url_obj.hostname;
    if (false && nm in iv_links) {
      final_urls.push(link);
      console.log(link);
    } else {
      let art: DocumentType<Article> = await findArticle(link);
      if (art) {
        final_urls.push(art.telegraph_url[0]);
      } else {
        if (
          !link.includes("telegra.ph") &&
          !link.includes("tprg.ru") &&
          !link.includes("tproger.ru")
        ) {
          const virtualConsole = new jsdom.VirtualConsole();
          let document = undefined;
          if (link.includes("vc.ru")) {
            document = await ndl("get", link, {
              follow_max: 5,
              decode_response: false,
            });
          } else {
            document = await ndl("get", link, {
              follow_max: 5,
              decode_response: true,
            });
          }

          const $ = cheerio.load(document.body);
          $("div[data-image-src]").replaceWith(function () {
            const src = $(this).attr("data-image-src");
            return `<img src=${src}>`;
          });
          var doc = undefined;
          try {
            doc = new JSDOM($.html(), {
              virtualConsole,
              url: link,
            });
          } catch {
            doc = new JSDOM($.html(), {
              virtualConsole,
            });
          }

          var documentClone = doc.window.document.cloneNode(true);
          if (isProbablyReaderable(documentClone)) {
            let parsed = new Readability(documentClone).parse();
            if (parsed == null) {
              console.log("parsed is null");
              return;
            }

            ctx.telegram.sendChatAction(ctx.chat.id, "typing");
            let content = parsed.content; //if null try to process directly with cheerio
            let title = parsed.title;

            const $ = cheerio.load(content);
            $.html();
            //todo: if table, transform it to image, upload to telegraph and insert path to it

            let transformed = (await Atransform($("body")[0]))[0];

            // console.log(JSON.stringify(transformed, null, 2));
            let chil = transformed.children.filter(
              (elem) =>
                typeof elem != "string" ||
                (typeof elem == "string" && elem.replace(/\s/g, "").length > 0)
            );

            const ph = new telegraph();
            const random_token = process.env.TELEGRAPH_TOKEN;
            let telegraf_links = Array<string>();

            let article_parts = splitArray(chil, link);
            // console.log(JSON.stringify(article_parts, null, 2));
            let parts_url = await createPages(
              article_parts,
              random_token,
              title,
              ph
            );
            addPrevNext(parts_url, random_token, title, ph);

            telegraf_links = parts_url;

            await createArticle(link, telegraf_links);

            final_urls.push(telegraf_links[0]);
            // ctx.replyWithHTML(telegraf_links.join(' '), { reply_to_message_id: ctx.message.message_id })
          }
        }
      }
      if (final_urls.length < l_ind + 1) {
        //link can't be transformed
        final_urls.push(link);
      }
    }
  }
  return final_urls;
}

function sendResponse(
  final_urls: Array<string>,
  url_place: Array<Array<number>>,
  url_type: Array<number>,
  ctx,
  reply = false
) {
  if (final_urls.length > 0) {
    console.log(final_urls);
    let orig_msg = "";
    if (reply) {
      orig_msg =
        "text" in ctx.message.reply_to_message
          ? ctx.message.reply_to_message.text
          : ctx.message.reply_to_message.caption;
    } else {
      orig_msg = "text" in ctx.message ? ctx.message.text : ctx.message.caption;
    }
    let new_msg = "";
    let last_ind = 0;
    for (let ind = 0; ind < final_urls.length; ++ind) {
      let elem = final_urls[ind];
      let [start, offset] = url_place[ind];
      let link_txt = orig_msg.substr(start, offset);
      let lnk = "";
      if (elem.includes("telegra.ph")) {
        if (
          elem.length > 4 &&
          [".mp4", ".jpg", ".png"].includes(elem.substr(elem.length - 4, 4))
        ) {
          lnk = ""; //filter url's with files
        } else {
          if (url_type[ind] == 1) {
            // lnk = `<a href='${elem}'>Instant View</a>`
            lnk = `<a href='${elem}'>${link_txt}[*]</a>`;
          } else {
            lnk = `<a href='${elem}'>${link_txt}[*]</a>`;
          }
        }
      } else {
        lnk = `<a href='${elem}'>${link_txt}</a>`; //keep original links if can't transform
      }

      new_msg = new_msg + orig_msg.substring(last_ind, start) + lnk;
      last_ind = start + offset;
    }
    new_msg = new_msg + orig_msg.substring(last_ind); //last chunk
    if (new_msg.length > 0) {
      ctx.replyWithHTML(new_msg, {
        reply_to_message_id: ctx.message.message_id,
      });
    }
  }
}

function toTable() {
  //               from telegraph import Telegraph
  // telegraph = Telegraph()
  // telegraph.create_account(short_name='1337')
  // with open('/Users/deantipin/picture.png', 'rb') as f:
  //     path = requests.post(
  //                     'https://telegra.ph/upload', files={'file':
  //                                                         ('file', f,
  //                                                         'image/jpeg')}).json()[0]['src']
  // response = telegraph.create_page(
  //     'Hey',
  //     html_content="<p>Hello, world!</p> \
  //                   <img src='{}'/>".format(path),
  // )
  // print('http://telegra.ph/{}'.format(response['path']))
}
