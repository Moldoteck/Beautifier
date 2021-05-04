import { Telegraf, Context } from 'telegraf'
const ndl = require("needle")
const puppeteer = require('puppeteer')
const telegraph = require('telegraph-node')
const cheerio = require('cheerio')
const { Readability } = require('@mozilla/readability');
var { JSDOM } = require('jsdom');
const jsdom = require('jsdom');
const util = require('util');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function setupBeautify(bot: Telegraf<Context>) {
  bot.on('text', async ctx => {
    if (ctx.message.text !== undefined) {
      const entities = ctx.message.entities || []
      let detected_urls = []
      for (const entity of entities) {
        if (entity.type === 'text_link' || entity.type === 'url') {
          if ('url' in entity) {
            console.log('url')
            detected_urls.push(entity.url)
          }
          else {
            console.log('not url')
            detected_urls.push((ctx.message.text).substr(
              entity.offset,
              entity.length
            ))
          }
        }
      }

      if (detected_urls.length > 0) {
        let link = detected_urls[0]
        if (!link.includes('telegra.ph')) {
          const virtualConsole = new jsdom.VirtualConsole();
          let document = await ndl('get', link)
          var doc = new JSDOM(document.body, { virtualConsole });
          let parsed = new Readability(doc.window.document).parse()
          if (parsed == null) {
            return
          }
          let content = parsed.content//if null try to process directly with cheerio
          let title = parsed.title

          const $ = cheerio.load(content);
          $.html()
          let transformed = transform($('body')[0])
          let chil = transformed.children.filter(elem => (typeof elem != 'string') || (typeof elem == 'string' && elem.replace(/\s/g, '').length > 0))

          if ((new util.TextEncoder().encode('' + chil)).length > 1520) {
            while ((new util.TextEncoder().encode('' + chil)).length > 1520) {
              chil = chil.slice(0, chil.length - 2)
            }
            //split into two articles
          }
          else {
            const ph = new telegraph()
            const random_token = process.env.TELEGRAPH_TOKEN
            let pg = await ph.createPage(random_token, title, chil, {
              return_content: true
            })
            ctx.reply(pg.url, { reply_to_message_id: ctx.message.message_id })
            console.log(pg.url)
          }
        }
      }
    }
  })
  bot.command(['help', 'start'], (ctx) => {
    ctx.replyWithHTML(ctx.i18n.t('help'))
  })
}

function transform(ob) {
  let root = undefined

  if (ob.type == 'text') {
    return ob.data
  }

  if (ob.type == 'div') {
    return
  }

  root = { tag: (ob).name, attrs: {}, children: [] }
  if (['h1', 'h2'].includes(root.tag)) {
    root.tag = 'b'
  }

  let at_detecetd = false
  if (ob.attribs) {
    if ('href' in ob.attribs) {
      root.attrs['href'] = ob.attribs['href']
      at_detecetd = true
    }
    if ('src' in ob.attribs) {
      root.attrs['src'] = ob.attribs['src']
      at_detecetd = true
    }
  }
  if (!at_detecetd) {
    delete root['attrs'];
  }

  let childs = ob.children
  if (childs != undefined) {
    let i = 0
    for (i = 0; i < childs.length; ++i) {
      if (childs[i].type == 'text' && (childs[i].data.replace(/^\s+/, '').replace(/\s+$/, '').length == 0))
        continue
      let chld = transform(childs[i])
      if (Array.isArray(chld)) {
        root.children = root.children.concat(chld)
      } else {
        root.children.push(transform(childs[i]))
      }
    }
  }

  if (root.children.length == 0) {
    delete root['children'];
  }

  if (['div', 'section'].includes(root.tag)) {
    return root.children
  }

  return root



}