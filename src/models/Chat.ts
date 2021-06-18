import { prop, getModelForClass } from '@typegoose/typegoose'

export class Chat {
    @prop({ required: true, index: true, unique: true })
    id: number

    @prop({ required: true, default: 'en' })
    language: string
    
    @prop({ required: true, default: false })
    interactive: boolean
}

// Get Chat model
const ChatModel = getModelForClass(Chat, {
    schemaOptions: { timestamps: true },
})

// Get or create chat
export async function findChat(id: number) {
    let chat = await ChatModel.findOne({ id })
    if (!chat) {
        try {
            chat = await new ChatModel({ id }).save()
        } catch (err) {
            chat = await ChatModel.findOne({ id })
        }
    }
    return chat
}

export async function findOnlyChat(id: number) {
    return await ChatModel.findOne({ id })
}

