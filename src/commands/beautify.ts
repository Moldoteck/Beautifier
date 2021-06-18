import { DocumentType } from '@typegoose/typegoose';
import { Telegraf, Context } from 'telegraf'
const ndl = require("needle")
const telegraph = require('telegraph-node')
const cheerio = require('cheerio')
const { Readability, isProbablyReaderable } = require('@mozilla/readability');
var { JSDOM } = require('jsdom');
const jsdom = require('jsdom');
const util = require('util');
import { findArticle, createArticle, deleteArticle, deleteAllArticles, Article } from '../models'

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function detectURL(message) {
  const entities = message.entities || message.caption_entities || []
  let detected_urls = []
  let url_place = []
  for (const entity of entities) {
    if (entity.type === 'text_link' || entity.type === 'url') {
      if ('url' in entity) {
        detected_urls.push(entity.url)
        url_place.push([entity.offset, entity.length])
      }
      else {
        if ('text' in message) {
          let det_url = (message.text).substr(
            entity.offset,
            entity.length
          )
          url_place.push([entity.offset, entity.length])
          detected_urls.push(det_url)
        }
        else if ('caption' in message) {
          let det_url = (message.caption).substr(
            entity.offset,
            entity.length
          )
          url_place.push([entity.offset, entity.length])
          detected_urls.push(det_url)
        }
      }
    }
  }
  //todo: delete duplicates
  return [detected_urls, url_place]
}

export function setupBeautify(bot: Telegraf<Context>) {
  bot.command(['help', 'start'], (ctx) => {
    ctx.replyWithHTML(ctx.i18n.t('help'))
  })
  bot.command('clear', async (ctx) => {
    if ('entities' in ctx.message.reply_to_message) {
      let [urls, _] = detectURL(ctx.message.reply_to_message)
      urls.forEach(async element => {
        await deleteArticle(element)
      });
    }

    await ctx.deleteMessage(ctx.message.message_id)
  })
  bot.command('clearAll', async (ctx) => {
    if (ctx.message.from.id == 180001222) {
      await deleteAllArticles()
    }
    await ctx.deleteMessage(ctx.message.message_id)
  })
  bot.on(['text', 'message'], async ctx => {
    if ('text' in ctx.message || 'caption' in ctx.message) {
      let [detected_urls, url_place] = detectURL(ctx.message)

      var final_urls = []

      for (let l_ind = 0; l_ind < detected_urls.length; ++l_ind) {
        let link = detected_urls[l_ind]
        if (!link.includes('http')) {
          link = 'http://' + link
        }
        let art: DocumentType<Article> = await findArticle(link)
        if (art) {
          final_urls.push(art.telegraph_url[0])
          let telegraf_links = transformLinks(art.telegraph_url)//`<a href='${art.telegraph_url}'>Beautiful link</a> `
        } else {
          if (!link.includes('telegra.ph') && !link.includes('tprg.ru') && !link.includes('tproger.ru')) {
            const virtualConsole = new jsdom.VirtualConsole();
            let document = await ndl('get', link, { follow_max: 5, decode_response: false })
            // console.log(document.body.slice(40000,50000))
            const $ = cheerio.load(document.body)
            $('div[data-image-src]').replaceWith(function () {
              const src = $(this).attr('data-image-src')
              return `<img src=${src}>`
            })
            var doc = undefined
            try {
              doc = new JSDOM($.html(), {
                virtualConsole,
                url: link
              })
            } catch {
              doc = new JSDOM($.html(), {
                virtualConsole
              })
            }

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

              // console.log($.html())
              let transformed = transform($('body')[0])
              let chil = transformed.children.filter(elem => (typeof elem != 'string') || (typeof elem == 'string' && elem.replace(/\s/g, '').length > 0))

              chil.unshift({ tag: 'br' })
              chil.unshift({ tag: 'a', attrs: { href: link }, children: ['Original link'] })
              chil.unshift({ tag: 'br' })
              chil.unshift({ tag: 'a', attrs: { href: 'https://t.me/BeautifierSimplifierBot' }, children: ['Made with Beautifier'] })

              let extra_chil = []
              let text_encoder = new util.TextEncoder()
              let ln = (text_encoder.encode(JSON.stringify(chil))).length

              const ph = new telegraph()
              const random_token = process.env.TELEGRAPH_TOKEN
              let telegraf_links = Array<string>()
              let article_parts = []
              while (chil.length > 0) {
                ln = (text_encoder.encode(JSON.stringify(chil))).length
                while (ln > 63000) {
                  extra_chil.unshift(chil[chil.length - 1])
                  chil = chil.slice(0, chil.length - 1)
                  ln = (text_encoder.encode(JSON.stringify(chil))).length
                }
                article_parts.push(chil)
                // console.log(JSON.stringify(chil, null, 2))
                // let pg = await ph.createPage(random_token, title, chil, {
                //   return_content: true
                // })

                chil = extra_chil
                extra_chil = []
                // telegraf_links.push(pg.url)
              }
              let prev_url = ''
              let pg = undefined
              for (let art_i = article_parts.length - 1; art_i >= 0; --art_i) {
                let part = article_parts[art_i]
                if (prev_url.length > 0) {
                  if (art_i != 0) {
                    part.unshift({ tag: 'br' })
                    part.unshift({ tag: 'a', attrs: { href: link }, children: ['Original link'] })
                    part.unshift({ tag: 'br' })
                    part.unshift({ tag: 'a', attrs: { href: 'https://t.me/BeautifierSimplifierBot' }, children: ['Made with Beautifier'] })
                  }
                  part.unshift({ tag: 'br' })
                  part.unshift({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${prev_url}` }, children: [`Next part ${art_i + 1}`] }] })
                } else {
                  if (article_parts.length > 1) {
                    part.unshift({ tag: 'br' })
                    part.unshift({ tag: 'a', attrs: { href: link }, children: ['Original link'] })
                    part.unshift({ tag: 'br' })
                    part.unshift({ tag: 'a', attrs: { href: 'https://t.me/BeautifierSimplifierBot' }, children: ['Made with Beautifier'] })
                  }
                }
                pg = await ph.createPage(random_token, title, part, {
                  return_content: true
                })
                prev_url = pg.url
                telegraf_links.push(pg.url)
              }
              telegraf_links.reverse()
              await createArticle(link, telegraf_links)

              final_urls.push(telegraf_links[0])
              console.log(final_urls)
              // telegraf_links = transformLinks(telegraf_links)

              // ctx.replyWithHTML(telegraf_links.join(' '), { reply_to_message_id: ctx.message.message_id })
            }
          }
        }
        if (final_urls.length < l_ind + 1) {
          final_urls.push(link)
        }
      }
      let msg = 'text' in ctx.message ? ctx.message.text : ctx.message.caption
      let new_msg = ''
      let last_ind = 0
      for (let ind = 0; ind < final_urls.length; ++ind) {
        let elem = final_urls[ind]
        let start = url_place[ind][0]
        let offset = url_place[ind][1]
        let txt = msg.substr(start, offset)
        // let lnk = `<a href='${elem}'>${txt}</a>`
        let lnk = `<a href='${elem}'>transformed link</a>`
        if (ind == 0) {
          new_msg = msg.substr(0, start) + lnk
          last_ind = start + offset
        } else {
          new_msg = new_msg + msg.substring(last_ind, start) + lnk
          last_ind = start + offset
        }
      }
      if (new_msg.length > 0) {
        ctx.replyWithHTML(new_msg, { reply_to_message_id: ctx.message.message_id })
      }
    }
  })
}

function transformLinks(links) {
  let transformed = []
  if (links.length == 1) {
    transformed.push(`<a href='${links[0]}'>Beautiful link</a>`)
  } else {
    let i = 0
    for (i = 0; i < links.length; ++i) {
      transformed.push(`<a href='${links[i]}'>Beautiful link ${i + 1}</a>`)
    }
  }
  return transformed
}

const allowed_tags = ['body', 'iframe', 'a', 'aside', 'b', 'blockquote', 'br', 'code', 'em', 'figcaption', 'figure', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul']
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
        if ('srcset' in ob.attribs && ob.attribs['srcset'].length > 0) {
          let srcset = ob.attribs['srcset'].split(', ')
          srcset = srcset[srcset.length - 1]
          srcset = srcset.split(' ')[0]
          root.attrs['src'] = srcset
          at_detecetd = true
        } else if ('data-src' in ob.attribs && ob.attribs['data-src'].length > 0) {
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
    let wout = ob.data.replace(/\s\s+/g, ' ')
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

  if (root.tag == 'iframe' && 'src' in root.attrs) {
    let real_yt = `https://www.youtube.com/watch?v=` + root.attrs['src'].split('?')[0].split('/embed/')[1]
    root = { tag: 'figure', children: [{ tag: 'iframe', attrs: { src: `/embed/youtube?url=${encodeURIComponent(real_yt)}` } }] }
    // return root
  }

  if ('data-image-src' in ob.attribs) {
    root.children.push({ tag: 'img', attrs: { 'src': ob.attribs['data-image-src'] } })
  }

  let childs = ob.children
  if (childs != undefined) {
    let i = 0
    for (i = 0; i < childs.length; ++i) {
      let chld = transform(childs[i])
      if (chld != "" && chld != null) {
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
