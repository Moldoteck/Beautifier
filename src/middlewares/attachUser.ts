import { findUser } from '../models'
import { Context } from 'telegraf'

export async function attachUser(ctx: Context, next) {
  let dbuser = undefined
  try{ dbuser= await findUser(ctx.from.id)} catch(err){console.log(err)}
  ctx.dbuser = dbuser
  return next()
}
