import { iv_links } from '@/helpers/iv_links';
import { DocumentType } from '@typegoose/typegoose';
import { Telegraf, Context, NarrowedContext } from 'telegraf'
// import {MatchedContext} from 'telegraf'
const telegraph = require('telegraph-node')
import { URL } from 'url';
const ndl = require("needle")
const cheerio = require('cheerio')

const { Readability, isProbablyReaderable } = require('@mozilla/readability');
var { JSDOM } = require('jsdom');
const jsdom = require('jsdom');

const util = require('util');
import { findArticle, createArticle, deleteArticle, deleteAllArticles, Article, findAllChats } from '../models'
import { countChats, countDocs } from '../models'
import { detectURL, processURL } from './urlprocessor';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


export async function extractDocument(link){
  const virtualConsole = new jsdom.VirtualConsole();
  let document = undefined
  if (link.includes('vc.ru')) {
    document = await ndl('get', link, { follow_max: 5, decode_response: false })
  } else {
    document = await ndl('get', link, { follow_max: 5, decode_response: true })
  }

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
  return doc
}

export function getMainContentFF(doc) {
  
  var documentClone = doc.window.document.cloneNode(true);
  if (isProbablyReaderable(documentClone)) {
    let parsed = new Readability(documentClone).parse()
    if (parsed == null) {
      console.log('parsed is null')
      return undefined
    }
    return parsed
  }
  return undefined
}


export function getMainContentOutline(doc) {
  //use bitly and after - outline.com with headless browser
}

  export function getDocumentBody(content){
    const $ = cheerio.load(content)
    $.html()
    return $('body')[0]
  }

          let link = detected_urls[l_ind]
          
          link = processURL(link)
          let url_obj = new URL(link)
          let nm = url_obj.hostname
          if (false && (nm in iv_links)) {
            final_urls.push(link)
            console.log(link)
          } else {

            let art: DocumentType<Article> = await findArticle(link)
            if (art) {
              final_urls.push(art.telegraph_url[0])
            } else {
              if (!link.includes('telegra.ph') && !link.includes('tprg.ru') && !link.includes('tproger.ru')) {
                const virtualConsole = new jsdom.VirtualConsole();
                let document = undefined
                if (link.includes('vc.ru')) {
                  document = await ndl('get', link, { follow_max: 5, decode_response: false })
                } else {
                  document = await ndl('get', link, { follow_max: 5, decode_response: true })
                }

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

                  ctx.telegram.sendChatAction(ctx.chat.id, "typing")
                  let content = parsed.content//if null try to process directly with cheerio
                  let title = parsed.title

                  const $ = cheerio.load(content)
                  $.html()
                  //todo: if table, transform it to image, upload to telegraph and insert path to it

                  // console.log($.html())
                  let transformed = transform($('body')[0])


                  let chil = transformed.children.filter(elem => (typeof elem != 'string') || (typeof elem == 'string' && elem.replace(/\s/g, '').length > 0))

                  let extra_chil = []
                  let text_encoder = new util.TextEncoder()
                  let ln = (text_encoder.encode(JSON.stringify(chil))).length

                  const ph = new telegraph()
                  const random_token = process.env.TELEGRAPH_TOKEN
                  let telegraf_links = Array<string>()
                  let article_parts = []

                  let prev_len = 0
                  while (chil.length > 0) {
                    ln = (text_encoder.encode(JSON.stringify(chil))).length
                    if (prev_len == chil.length) { break }
                    prev_len = chil.length
                    while (ln > 60000) {
                      extra_chil.unshift(chil[chil.length - 1])
                      chil = chil.slice(0, chil.length - 1)
                      ln = (text_encoder.encode(JSON.stringify(chil))).length
                    }
                    chil.unshift({ tag: 'br' })
                    chil.unshift({ tag: 'a', attrs: { href: 'https://' + nm }, children: [nm] })
                    chil.unshift(` from `)
                    chil.unshift({ tag: 'a', attrs: { href: link }, children: ['Original link'] })
                    chil.unshift({ tag: 'br' })
                    chil.unshift({ tag: 'br' })
                    chil.unshift({ tag: 'a', attrs: { href: 'https://t.me/BeautifierSimplifierBot' }, children: ['Made with Beautifier'] })

                    article_parts.push(chil)

                    chil = extra_chil
                    extra_chil = []
                  }

                  let pg = undefined
                  let parts_url = []
                  for (let art_i = 0; art_i < article_parts.length; ++art_i) {
                    let part = article_parts[art_i]

                    pg = await ph.createPage(random_token, title, part, {
                      return_content: true
                    })
                    parts_url.push(pg.url)
                  }

                  for (let art_i = 0; art_i < parts_url.length; ++art_i) {
                    let url = parts_url[art_i]
                    let old_page = await ph.getPage(url.split('/').slice(-1)[0], {
                      return_content: true
                    })
                    let content = old_page.content

                    if (art_i < parts_url.length - 1) {
                      content.unshift({ tag: 'br' })
                      content.unshift({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${parts_url[art_i + 1]}` }, children: [`Next part ${art_i + 1}`] }] })
                    }
                    if (art_i > 0) {
                      content.unshift({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${parts_url[art_i - 1]}` }, children: [`Prev part ${art_i - 1}`] }] })
                    }

                    if (art_i > 0) {
                      content.push({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${parts_url[art_i - 1]}` }, children: [`Prev part ${art_i - 1}`] }] })
                    }
                    if (art_i < parts_url.length - 1) {
                      content.push({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${parts_url[art_i + 1]}` }, children: [`Next part ${art_i + 1}`] }] })
                      content.push({ tag: 'br' })
                    }
                    await ph.editPage(random_token, url.split('/').slice(-1)[0], title, content, {
                      return_content: true
                    })
                  }

                  // prev_url = pg.url
                  telegraf_links = parts_url

                  // let tmp = await ph.getPage(pg.url.split('/').slice(-1)[0], {
                  //   return_content: true
                  // })
                  // console.log(JSON.stringify(tmp.content, null, 2))
                  // if (prev_url.length > 0) {
                  //   part.unshift({ tag: 'br' })
                  //   part.unshift({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${prev_url}` }, children: [`Next part ${art_i + 1}`] }] })

                  //   part.push({ tag: 'br' })
                  //   part.push({ tag: 'h3', children: [{ tag: 'a', attrs: { href: `${prev_url}` }, children: [`Next part ${art_i + 1}`] }] })
                  // }
                  // telegraf_links.reverse()
                  await createArticle(link, telegraf_links)

                  final_urls.push(telegraf_links[0])
                  // ctx.replyWithHTML(telegraf_links.join(' '), { reply_to_message_id: ctx.message.message_id })
                }
              }
            }
            if (final_urls.length < l_ind + 1) {
              //link can't be transformed
              final_urls.push(link)
            }
          }

function sendResponse(final_urls: Array<string>, url_place: Array<Array<number>>, url_type: Array<number>, ctx) {
  if (final_urls.length > 0) {
    console.log(final_urls)
    let orig_msg = 'text' in ctx.message ? ctx.message.text : ctx.message.caption
    let new_msg = ''
    let last_ind = 0
    for (let ind = 0; ind < final_urls.length; ++ind) {
      let elem = final_urls[ind]
      let [start, offset] = url_place[ind]
      let link_txt = orig_msg.substr(start, offset)
      let lnk = ''
      if (elem.includes('telegra.ph')) {
        if (elem.length > 4 && ['.mp4', '.jpg', '.png'].includes(elem.substr(elem.length - 4, 4))) {
          lnk = '' //filter url's with files
        } else {
          if (url_type[ind] == 1) {
            lnk = `<a href='${elem}'>Instant View</a>`
          } else {
            lnk = `<a href='${elem}'>${link_txt}[*]</a>`
          }
        }
      } else {
        lnk = `<a href='${elem}'>${link_txt}</a>`//keep original links if can't transform
      }

      new_msg = new_msg + orig_msg.substring(last_ind, start) + lnk
      last_ind = start + offset
    }
    new_msg = new_msg + orig_msg.substring(last_ind)//last chunk
    if (new_msg.length > 0) {
      ctx.replyWithHTML(new_msg, { reply_to_message_id: ctx.message.message_id })
    }
  }
}

const allowed_tags = ['body', 'iframe', 'a', 'aside', 'b', 'br', 'blockquote', 'code', 'em', 'figcaption', 'figure', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'strong', 'u', 'ul']
const block_tags = ['div', 'section', 'article', 'main', 'header', 'span', 'center', 'picture']

function parseAttribs(root, ob) {
  let at_detecetd = false
  let img_size_thresh = 100
  if (ob.attribs) {
    if ('href' in ob.attribs) {
      root.attrs['href'] = ob.attribs['href']
      at_detecetd = true
    }
    let bad_width = false
    if ('src' in ob.attribs) {
      if ('width' in ob.attribs) {
        if ((!isNaN(ob.attribs['width'])) && ob.attribs['width'] <= img_size_thresh) {
          bad_width = true
        }
      }
      if ('height' in ob.attribs) {
        if ((!isNaN(ob.attribs['height'])) && ob.attribs['height'] <= img_size_thresh) {
          bad_width = true
        }
      }
      if (!bad_width) {
        let final_src = []
        if ('srcset' in ob.attribs && ob.attribs['srcset'].length > 0) {
          let srcset = ob.attribs['srcset'].split(', ')
          srcset = srcset[srcset.length - 1]
          srcset = srcset.split(' ')[0]
          final_src.push(srcset.split('?')[0])
          at_detecetd = true
        }
        if ('data-src' in ob.attribs && ob.attribs['data-src'].length > 0) {
          final_src.push(ob.attribs['data-src'].split('?')[0])
          at_detecetd = true
        }
        if ('src' in ob.attribs) {
          final_src.push(ob.attribs['src'].split('?')[0])
          at_detecetd = true
        }
        if (at_detecetd) {
          at_detecetd = false
          for (let i = 0; i < final_src.length; ++i) {
            if ((!final_src[i].includes('.svg')) && (final_src[i].includes('http'))) {//svg are not supported, link should have http
              root.attrs['src'] = final_src[i]
              at_detecetd = true
            }
          }
        }
      }
    }
  }
  if (!at_detecetd) {
    delete root['attrs'];
  }
  return root
}

function transformTagElements(root) {
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
  return root
}

function embedVideos(root) {
  if (root.tag == 'iframe' && root.attrs && 'src' in root.attrs) {
    //embed yt video
    //TODO: embed telegram, twitter and vimeo elements too
    let real_yt = `https://www.youtube.com/watch?v=` + root.attrs['src'].split('?')[0].split('/embed/')[1]
    root = { tag: 'figure', children: [{ tag: 'iframe', attrs: { src: `/embed/youtube?url=${encodeURIComponent(real_yt)}` } }] }
    // return root
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
  root = transformTagElements(root)

  if (!allowed_tags.includes(root.tag) && !block_tags.includes(root.tag)) {
    return undefined
  }

  root = parseAttribs(root, ob)
  root = embedVideos(root)

  if ('data-image-src' in ob.attribs) {//needed for vc.ru
    //TODO: check if link is valid
    root.children.push({ tag: 'img', attrs: { 'src': ob.attribs['data-image-src'] } })
  }

  let childs = ob.children
  if (childs != undefined) {
    for (let i = 0; i < childs.length; ++i) {
      let chld = transform(childs[i])
      if (chld) {
        if (Array.isArray(chld)) {
          root.children = root.children.concat(chld)
        } else {
          if (typeof chld == "string") {
            if (['ul', 'ol'].includes(root.tag) && chld == '\n') {//avoid newline in lists
              continue
            }
            if (chld.indexOf('\n') == 0) {//if /n is first element of string
              chld = chld.substring(1)
            }
          }
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
