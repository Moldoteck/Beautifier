import needle = require("needle");

const allowed_tags = {
  body: 1,
  iframe: 1,
  a: 1,
  aside: 1,
  b: 1,
  br: 1,
  blockquote: 1,
  code: 1,
  em: 1,
  figcaption: 1,
  figure: 1,
  h3: 1,
  h4: 1,
  hr: 1,
  i: 1,
  img: 1,
  li: 1,
  ol: 1,
  p: 1,
  pre: 1,
  s: 1,
  strong: 1,
  u: 1,
  ul: 1,
};
const should_have_childs = {
  body: 1,
  iframe: 1,
  a: 1,
  aside: 1,
  b: 1,
  blockquote: 1,
  code: 1,
  em: 1,
  figcaption: 1,
  figure: 1,
  h3: 1,
  h4: 1,
  hr: 1,
  i: 1,
  li: 1,
  ol: 1,
  p: 1,
  pre: 1,
  s: 1,
  strong: 1,
  u: 1,
  ul: 1,
};
const block_tags = {
  div: 1,
  section: 1,
  article: 1,
  main: 1,
  header: 1,
  span: 1,
  center: 1,
  picture: 1,
};

async function parseAttribs(root, ob) {
  let at_detecetd = false;
  let img_size_thresh = 100;
  if (ob.attribs) {
    if ("href" in ob.attribs) {
      root.attrs["href"] = ob.attribs["href"];
      at_detecetd = true;
    }
    if ("src" in ob.attribs) {
      //populate width and height attributes
      //
      let bad_width = false;
      if ("width" in ob.attribs) {
        if (
          !isNaN(ob.attribs["width"]) &&
          ob.attribs["width"] <= img_size_thresh
        ) {
          bad_width = true;
        }
      }
      if ("height" in ob.attribs) {
        if (
          !isNaN(ob.attribs["height"]) &&
          ob.attribs["height"] <= img_size_thresh
        ) {
          bad_width = true;
        }
      }

      let final_src = [];
      if ("src" in ob.attribs) {
        let src = ob.attribs["src"].split("?")[0];
        final_src.push(src);
        if (root.tag == "iframe" || root.tag == "video") {
          root.attrs["src"] = src;
          return root;
        }
        final_src.push(ob.attribs["src"]); //maybe ? can get image
      }
      if ("data-src" in ob.attribs && ob.attribs["data-src"].length > 0) {
        let src = ob.attribs["data-src"].split("?")[0];
        final_src.push(src);
      }
      if ("srcset" in ob.attribs && ob.attribs["srcset"].length > 0) {
        let srcset = ob.attribs["srcset"].split(", ");
        srcset = srcset.pop(); //get last
        srcset = srcset.split(" ")[0];
        let src = srcset.split("?")[0];
        final_src.push(src);
      }

      for (let i = 1; i < final_src.length; ++i) {
        try {
          let rs = await needle("head", final_src[i]);
          if (
            rs.statusCode == 200 &&
            rs.headers["content-type"].match(/(image)+\//g).length != 0
          ) {
            root.attrs["src"] = final_src[i];
            at_detecetd = true;
            break;
          }
        } catch (e) {
          console.log("Error is " + e);
        }
      }
    }
  }
  if (!at_detecetd) {
    delete root["attrs"];
  }
  return root;
}

function embedVideos(root) {
  if (root.tag == "iframe" && root.attrs && root.attrs["src"]) {
    //embed yt video
    //TODO: embed telegram, twitter and vimeo elements too
    let real_yt =
      `https://www.youtube.com/watch?v=` +
      root.attrs["src"].split("?")[0].split("/embed/")[1];
    root = {
      tag: "figure",
      children: [
        {
          tag: "iframe",
          attrs: { src: `/embed/youtube?url=${encodeURIComponent(real_yt)}` },
        },
      ],
    };
  }
  return root;
}

export async function Atransform(rootObject) {
  let root = undefined;
  if (rootObject.type == "text") {
    let txt = processTextObject(rootObject);
    if (["ul", "ol"].includes(rootObject.parentNode.name) && txt == "\n") {
      //avoid newline in lists
      return [];
    }
    return txt != "" && txt != " " ? [txt] : [];
  }

  root = { tag: rootObject.name, attrs: {}, children: [] };
  root = transformTagElements(root);

  if (!allowed_tags[root.tag] && !block_tags[root.tag]) {
    return [];
  }
  root = await parseAttribs(root, rootObject);
  root = embedVideos(root);

  if ("data-image-src" in rootObject.attribs) {
    //needed for vc.ru
    let src: string = rootObject.attribs["data-image-src"];
    if (
      src.endsWith(".jpg") ||
      src.endsWith(".jpeg") ||
      src.endsWith(".png") ||
      src.endsWith(".gif")
    ) {
      try {
        let rs = await needle("head", rootObject.attribs["data-image-src"]);
        if (rs.statusCode == 200) {
          root.children.push({
            tag: "img",
            attrs: { src: rootObject.attribs["data-image-src"] },
          });
        }
      } catch (e) {
        console.log("Error is " + e);
      }
    }
  }

  let childs = rootObject.children;
  if (childs != undefined) {
    for (let i = 0; i < childs.length; ++i) {
      let chld = await Atransform(childs[i]);
      if (chld) {
        if (chld.length > 8000) {
          root.children.push(...chld); //faster
        } else {
          for (let i in chld) {
            root.children.push(chld[i]);
          }
        }
      }
    }
  }

  if (root.children.length == 0) {
    delete root["children"];
  }

  if (block_tags[root.tag]) {
    return root.children ? root.children : [];
  }

  return !root.children && should_have_childs[root.tag] ? [] : [root];
}

function transformTagElements(root) {
  switch (root.tag) {
    case "h1":
    case "h2":
      root.tag = "b";
      break;
    case "h5":
    case "h6":
      root.tag = "h4";
      break;
    case "details":
      root.tag = "blockquote";
      break;
    case "summary":
      root.tag = "b";
      root.children.push({ tag: "br" });
      break;
  }
  return root;
}

function processTextObject(rootObject) {
  if (rootObject.data.includes("author_name")) return "";
  let wout = rootObject.data.replace(/\s\s+/g, " ");
  wout == " " ? "" : wout;
  wout = wout[0] == "\n" ? wout.substring(1) : wout;
  return wout;
}
