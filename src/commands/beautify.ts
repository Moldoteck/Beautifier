import { Telegraf, Context } from 'telegraf'
const ndl = require("needle")
const puppeteer = require('puppeteer')
const telegraph = require('telegraph-node')
const cheerio = require('cheerio')
const { Readability, isProbablyReaderable } = require('@mozilla/readability');
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

      console.log(detected_urls)
      if (detected_urls.length > 0) {
        detected_urls.forEach(async link => {
          if (!link.includes('telegra.ph')) {
            const virtualConsole = new jsdom.VirtualConsole();
            let document = await ndl('get', link, { follow_max: 5 })

            var doc = new JSDOM(document.body, { virtualConsole, 
              url: link })
            //check if should parse
            if (isProbablyReaderable(doc.window.document)) {
              let parsed = new Readability(doc.window.document).parse()
              if (parsed == null) {
                console.log('parsed is null')
                return
              }
              let content = parsed.content//if null try to process directly with cheerio
              let title = parsed.title
              const $ = cheerio.load(content);
              $.html()
              //todo: if table, transform it to image, upload to telegraph and insert path to it
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
              let transformed = transform($('body')[0])
              // console.log(transformed)
              let chil = transformed.children.filter(elem => (typeof elem != 'string') || (typeof elem == 'string' && elem.replace(/\s/g, '').length > 0))

              //1520
              if ((new util.TextEncoder().encode(JSON.stringify(chil))).length > 63000) {
                let ln=(new util.TextEncoder().encode(JSON.stringify(chil))).length 
                while (ln > 63000) {
                  chil = chil.slice(0, chil.length - 1)
                  ln=(new util.TextEncoder().encode(JSON.stringify(chil))).length 
                  // console.log((new util.TextEncoder().encode(JSON.stringify(chil))).length)
                }
                chil.push({ tag: 'p', children: ['TRIMMED DOCUMENT'] })
                //split into two articles
              }

              console.log(chil.length)
              // console.log(JSON.stringify(chil))
              const ph = new telegraph()
              const random_token = process.env.TELEGRAPH_TOKEN
              let pg = await ph.createPage(random_token, title, chil, {
                return_content: true
              })
              ctx.replyWithHTML(`<a href='${pg.url}'>Beautiful link</a>`, { reply_to_message_id: ctx.message.message_id })
              console.log(pg.url)
            }
          }
        });
      }
    }
  })
  bot.command(['help', 'start'], (ctx) => {
    ctx.replyWithHTML(ctx.i18n.t('help'))
  })
}

function transform(ob) {
  let allowed_tags = ['body', 'a', 'aside', 'b', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h3', 'h4', 'hr', 'i', 'iframe', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul', 'video']
  let root = undefined

  if (ob.type == 'text') {
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

  if (!allowed_tags.includes(root.tag) && !['div', 'section', 'article', 'details', 'summary', 'main', 'header', 'span'].includes(root.tag)) {
    return ""
  }

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

  let childs = ob.children
  if (childs != undefined) {
    let i = 0
    for (i = 0; i < childs.length; ++i) {
      // if (childs[i].type == 'text' && (childs[i].data.replace(/^\s+/, '').replace(/\s+$/, '').length == 0))
      //   continue
      let chld = transform(childs[i])
      if (Array.isArray(chld)) {
        root.children = root.children.concat(chld)
      } else {
        root.children.push(chld)
      }
    }
  }

  if (root.children.length == 0) {
    delete root['children'];
  }

  if (['div', 'section', 'article', 'main', 'header', 'span'].includes(root.tag)) {
    return root.children
  }
  if (root.tag == 'details') {
    root.tag = 'blockquote'
  }
  if (root.tag == 'summary') {
    root.tag = 'b'
    root.children.push({ tag: 'br' })
  }

  return root
}