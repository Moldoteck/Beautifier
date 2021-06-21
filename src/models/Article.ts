import { prop, getModelForClass } from '@typegoose/typegoose'

export class Article {
  @prop({ required: true, default: '' })
  url: string
  @prop({ required: true, default: [] })
  telegraph_url: [string]
}

// Get Article model
const ArticleModel = getModelForClass(Article, {
  schemaOptions: { timestamps: true },
})

// Create article
export async function createArticle(url: string, telegraph_url: string[]) {
  let article = await ArticleModel.findOne({ url })
  if (!article) {
    try {
      article = await new ArticleModel({ url, telegraph_url }).save()
    } catch (err) {
      article = await ArticleModel.findOne({ url })
    }
  }
  return article
}
// Get article
export async function findArticle(url: string) {
  let article = await ArticleModel.findOne({ url })
  return article
}

// Delete article
export async function deleteArticle(url: string) {
  let article = await ArticleModel.findOne({ url })
  if (article) {
    await ArticleModel.deleteOne({ url })
  }
}

// Delete all articles
export async function deleteAllArticles() {
  await ArticleModel.deleteMany({})
}

export async function countDocs() {
  return await ArticleModel.countDocuments({})
}