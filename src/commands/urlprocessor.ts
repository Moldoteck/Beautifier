export function detectURL(message) {
  const entities = message.entities || message.caption_entities || []
  let detected_urls = []
  let url_place = []
  let url_type = []
  for (const entity of entities) {
    if (entity.type === 'text_link' || entity.type === 'url') {
      if ('url' in entity) {
        detected_urls.push(entity.url)
        url_place.push([entity.offset, entity.length])
        url_type.push(0)
      }
      else {
        if ('text' in message) {
          let det_url = (message.text).substr(
            entity.offset,
            entity.length
          )
          url_place.push([entity.offset, entity.length])
          detected_urls.push(det_url)
          url_type.push(1)
        }
        else if ('caption' in message) {
          let det_url = (message.caption).substr(
            entity.offset,
            entity.length
          )
          url_place.push([entity.offset, entity.length])
          detected_urls.push(det_url)
          url_type.push(1)
        }
      }
    }
  }
  return [detected_urls, url_place, url_type]
}

export function processURL(url){ 
  if (!url.includes('http')) {
    url = 'http://' + url
  }

  if (url.includes('ncbi.nlm.nih.gov') && (!url.includes('?report=classic'))) {
    url = url + '?report=classic'
  }
  return url
}