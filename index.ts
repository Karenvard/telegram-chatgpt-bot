import { config } from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";

config();

const token = process.env.BOT_TOKEN || "";
const bot = new TelegramBot(token, { polling: true });

const openai = new OpenAI();

const chatGptModels = {
    "GPT-3.5 Turbo": "gpt-3.5-turbo",
    "GPT-4": "gpt-4",
    "GPT-4 Turbo": "gpt-4-turbo",
    "GPT-4o mini": "gpt-4o-mini",
    "GPT-4o": "gpt-4o"
}
class User {
    currentModel: string;
    chooseModelMessageId: number | null = null;
    lastQuestion: string = "";
    lastCompletion: string = "";
    constructor(model?: string) {
        this.currentModel = model || "gpt-3.5-turbo";
    }
}

const usersInfo = new Map<number, User>();

function parseLatexInText(inputText: string) {
    function latexToReadable(latex: string) {
        return latex
            .replace(/\\int_({.*?})\^({.*?})/g, '∫[$1, $2]')
            .replace(/\\frac{(.*?)}{(.*?)}/g, '($1 / $2)')
            .replace(/_{(.*?)}/g, '_$1')
            .replace(/\^{(.*?)}/g, '^$1')
            .replace(/\\,/g, ' ')
            .replace(/\\left\[(.*?)\\right\]/g, '[$1]')
            .replace(/\\right|\\left/g, '')
            .replace(/\\dx|\\d/g, ' dx')
            .replace(/\\/, '')
            .replace(/\s+/g, ' ');
    }
    const latexRegex = /\\int[\s\S]*?dx|\\frac{[\s\S]*?}{[\s\S]*?}/g;
    const resultText = inputText.replace(latexRegex, (match) => latexToReadable(match));

    return resultText;
}
async function start() {

    bot.setMyCommands([
        { command: "/start", description: "Start conversation with bot" },
        { command: "/model", description: "Choose ChatGPT Model" },
        { command: "/clear", description: "Clear ChatGPT memory about previous conversation" }
    ])

    bot.on("message", async msg => {
        const text: string = msg.text || "";
        const chatId: number = msg.chat.id;

        if (!usersInfo.has(chatId)) {
            usersInfo.set(chatId, new User());
        }

        if (text === "/start") {
            return await bot.sendMessage(chatId, "Hello! I am AI ChatGPT bot. You can ask me some questions and I will answer!");
        } else if (text === "/model") {
            const userInfo = usersInfo.get(chatId);
            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "GPT-3.5 Turbo",
                                callback_data: chatGptModels["GPT-3.5 Turbo"]
                            },
                            {
                                text: "GPT-4",
                                callback_data: chatGptModels["GPT-4"]
                            },
                        ],
                        [
                            {
                                text: "GPT-4 Turbo",
                                callback_data: chatGptModels["GPT-4 Turbo"]
                            },
                            {
                                text: "GPT-4o mini",
                                callback_data: chatGptModels["GPT-4o mini"]
                            },
                        ],
                        [
                            {
                                text: "GPT-4o",
                                callback_data: chatGptModels["GPT-4o"]
                            }
                        ]
                    ]
                }
            };
            return bot.sendMessage(chatId, "GPT-3.5 Turbo - a fast, inexpensive model for simple tasks \n\n" +
                "GPT-4 and GPT-4 Turbo - the previous set of high-intelligence models \n\n" +
                "GPT-4o mini - affordable and intelligent small model for fast, lightweight tasks \n\n" +
                "GPT-4o - high-intelligence flagship model for complex, multi-step tasks", opts).then(msg => {
                    if (userInfo) {
                        userInfo.chooseModelMessageId = msg.message_id;
                    }
                });
        } else if (text === "/clear") {
            const userInfo = usersInfo.get(chatId);
            if (!userInfo) return;
            userInfo.lastCompletion = "";
            return await bot.sendMessage(chatId, "ChatGPT memory cleared!");
        } else {
            const response = await openai.chat.completions.create({
                model: usersInfo.get(chatId)?.currentModel || "gpt-3.5-turbo",
                messages: [
                    {
                        role: "user",
                        content: [{ type: "text", text: usersInfo.get(chatId)?.lastQuestion || "" }]
                    },
                    {
                        role: "assistant",
                        content: [{ type: "text", text: usersInfo.get(chatId)?.lastCompletion || "" }]
                    },
                    {
                        role: "user",
                        content: [{ type: "text", text }]
                    },
                ],
            })
            const answer = parseLatexInText(response.choices[0].message.content as string);
            await bot.sendMessage(chatId, answer, { reply_to_message_id: msg.message_id });
            const userInfo = usersInfo.get(chatId);
            if (!userInfo) return;
            userInfo.lastQuestion = text;
            userInfo.lastCompletion = answer;
        }
    })

    bot.on("callback_query", async callback => {
        const userInfo = usersInfo.get(callback.from.id);
        if (!userInfo) throw Error("User info not found");
        if (!callback.data) throw Error("Callback data not found");
        userInfo.currentModel = callback.data;
        if (!userInfo.chooseModelMessageId) throw Error("Choose model message id not found");
        await bot.editMessageText("ChatGPT model set to " + Object.keys(chatGptModels).find(key => chatGptModels[key as keyof typeof chatGptModels] === callback.data), {chat_id: callback.from.id, message_id: userInfo.chooseModelMessageId});
    })
}

start();