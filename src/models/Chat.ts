import { prop, getModelForClass } from '@typegoose/typegoose'

export class Chat {
    @prop({ required: true, index: true, unique: true })
    id: number

    @prop({ required: true, default: 'en' })
    language: string
    
    @prop({ required: true, default: true })
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
//function to delete chat by id
export async function deleteChat(id: number) {
    await ChatModel.deleteOne({ id })
}

export async function findOnlyChat(id: number) {
    return await ChatModel.findOne({ id })
}

export async function findAllChats() {
    return await ChatModel.find({})
}

export async function countChats() {
    return await ChatModel.countDocuments({})
}
