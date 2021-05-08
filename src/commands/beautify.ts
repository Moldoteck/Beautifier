import { Telegraf, Context } from 'telegraf'
const ndl = require("needle")
const telegraph = require('telegraph-node')
const cheerio = require('cheerio')
const { Readability, isProbablyReaderable } = require('@mozilla/readability');
var { JSDOM } = require('jsdom');
const jsdom = require('jsdom');
const util = require('util');
import { findArticle, createArticle } from '../models'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function detectURL(ctx) {
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
  //todo: delete duplicates
  return detected_urls
}

export function setupBeautify(bot: Telegraf<Context>) {
  bot.on('text', async ctx => {
    if (ctx.message.text !== undefined) {
      let detected_urls = detectURL(ctx)

      console.log(detected_urls)
      detected_urls.forEach(async link => {
        let art = await findArticle(link)
        if (art) {
          let telegraf_links = `<a href='${art.telegraph_url}'>Beautiful link</a> `
          ctx.replyWithHTML(telegraf_links, { reply_to_message_id: ctx.message.message_id })
        } else {
          if (!link.includes('telegra.ph')) {
            const virtualConsole = new jsdom.VirtualConsole();
            let document = await ndl('get', link, { follow_max: 5 })
            const $ = cheerio.load(document.body)
            $('div[data-image-src]').replaceWith(function () {
              const src = $(this).attr('data-image-src')
              return `<img src=${src}>`
            })
            var doc = new JSDOM($.html(), {
              virtualConsole,
              url: link
            })

            var documentClone = doc.window.document.cloneNode(true);
            if (isProbablyReaderable(documentClone)) {
              let parsed = new Readability(documentClone).parse()
              if (parsed == null) {
                console.log('parsed is null')
                return
              }
              let content = parsed.content//if null try to process directly with cheerio
              let title = parsed.title

              const $ = cheerio.load(content)
              $.html()
              //todo: if table, transform it to image, upload to telegraph and insert path to it

              let transformed = transform($('body')[0])
              let chil = transformed.children.filter(elem => (typeof elem != 'string') || (typeof elem == 'string' && elem.replace(/\s/g, '').length > 0))

              chil.unshift({ tag: 'br' })
              chil.unshift({ tag: 'a', attrs: { href: link }, children: ['Original link'] })

              let extra_chil = []
              let text_encoder = new util.TextEncoder()
              let ln = (text_encoder.encode(JSON.stringify(chil))).length

              const ph = new telegraph()
              const random_token = process.env.TELEGRAPH_TOKEN
              let telegraf_links = []
              while (chil.length > 0) {
                console.log(ln)
                ln = (text_encoder.encode(JSON.stringify(chil))).length
                while (ln > 63000) {
                  extra_chil.unshift(chil[chil.length - 1])
                  chil = chil.slice(0, chil.length - 1)
                  ln = (text_encoder.encode(JSON.stringify(chil))).length
                }

                let pg = await ph.createPage(random_token, title, chil, {
                  return_content: true
                })

                chil = [...extra_chil]
                extra_chil = []
                telegraf_links.push(`<a href='${pg.url}'>Beautiful link</a> `)
                if (telegraf_links.length == 1) {
                  await createArticle(link, pg.url)
                }
              }

              ctx.replyWithHTML(telegraf_links.join(' '), { reply_to_message_id: ctx.message.message_id })
            }
          }
        }
      });
    }
  })
  bot.command(['help', 'start'], (ctx) => {
    ctx.replyWithHTML(ctx.i18n.t('help'))
  })
}

const allowed_tags = ['body', 'a', 'aside', 'b', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h3', 'h4', 'hr', 'i', 'iframe', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul', 'video']
const block_tags = ['div', 'section', 'article', 'main', 'header', 'span']

function parseAttribs(root, ob) {
  let at_detecetd = false
  if (ob.attribs) {
    if ('href' in ob.attribs) {
      root.attrs['href'] = ob.attribs['href']
      at_detecetd = true
    }
    let bad_width = false
    if ('src' in ob.attribs) {
      if ('width' in ob.attribs) {
        if ((!isNaN(ob.attribs['width'])) && ob.attribs['width'] <= 100) {
          bad_width = true
        }
      }
      if ('height' in ob.attribs) {
        if ((!isNaN(ob.attribs['height'])) && ob.attribs['height'] <= 100) {
          bad_width = true
        }
      }
      if (!bad_width) {
        if ('srcset' in ob.attribs) {
          let srcset = ob.attribs['srcset'].split(', ')
          srcset = srcset[srcset.length - 1]
          srcset = srcset.split(' ')[0]
          root.attrs['src'] = srcset
          at_detecetd = true
        } else if ('data-src' in ob.attribs) {
          root.attrs['src'] = ob.attribs['data-src']
          at_detecetd = true
        } else {
          root.attrs['src'] = ob.attribs['src']
          at_detecetd = true
        }
      }
    }
  }
  if (!at_detecetd) {
    delete root['attrs'];
  }
  return root
}

function transform(ob) {
  let root = undefined

  if (ob.type == 'text') {
    if (ob.data.includes('author_name'))
      return ""
    let wout = ob.data.replace(/\s\s+/g, ' ');
    return wout == ' ' ? "" : wout;
  }

  root = { tag: (ob).name, attrs: {}, children: [] }
  if (['h1', 'h2'].includes(root.tag)) {
    root.tag = 'b'
  }
  if (['h5', 'h6'].includes(root.tag)) {
    root.tag = 'h4'
  }
  if (root.tag == 'details') {
    root.tag = 'blockquote'
  }
  if (root.tag == 'summary') {
    root.tag = 'b'
    root.children.push({ tag: 'br' })
  }

  if (!allowed_tags.includes(root.tag) && !block_tags.includes(root.tag)) {
    return ""
  }

  root = parseAttribs(root, ob)

  if ('data-image-src' in ob.attribs) {
    root.children.push({ tag: 'img', attrs: { 'src': ob.attribs['data-image-src'] } })
  }

  let childs = ob.children
  if (childs != undefined) {
    let i = 0
    for (i = 0; i < childs.length; ++i) {
      let chld = transform(childs[i])
      if (chld != "") {
        if (Array.isArray(chld)) {
          root.children = root.children.concat(chld)
        } else {
          root.children.push(chld)
        }
      }
    }
  }

  if (root.children.length == 0) {
    delete root['children'];
  }

  if (block_tags.includes(root.tag)) {
    return root.children
  }

  return root
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