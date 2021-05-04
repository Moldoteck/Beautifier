// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { bot } from '@/helpers/bot'
import { checkTime } from '@/middlewares/checkTime'
import { setupHelp } from '@/commands/help'
import { setupBeautify } from '@/commands/beautify'
import { setupI18N } from '@/helpers/i18n'
import { setupLanguage } from '@/commands/language'
import { attachUser } from '@/middlewares/attachUser'

// Check time
bot.use(checkTime)
// Attach user
bot.use(attachUser)
// Setup localization
setupI18N(bot)
// Setup commands
setupHelp(bot)
setupLanguage(bot)
setupBeautify(bot)

// Start bot
bot.launch().then(() => {
  console.info('Bot is up and running')
})
