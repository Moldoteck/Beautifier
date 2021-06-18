import { findChat } from '../models'
import { Context } from 'telegraf'

export async function attachChat(ctx: Context, next) {
  if (ctx.from != undefined) {
    const dbchat = await findChat(ctx.chat.id)
    ctx.dbchat = dbchat
  }
  return next()
}
