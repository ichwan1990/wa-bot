const axios = require("axios");

async function getOllamaChatCompletion(prompt) {
    try {
        const response = await axios.post("http://192.168.88.11:11434/api/chat", {
            model: "deepseek-r1:7b",
            messages: [{ role: "user", content: prompt }],
            stream: false
        }, {
            headers: { "Content-Type": "application/json" }
        });

        let content = response.data.message.content;
        content = content.replace(/<think>[\s\S]*?<\/think>/g, "");
        return content.trim();
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
        return "Maaf, terjadi kesalahan dalam mendapatkan respon AI.";
    }
}

module.exports = { getOllamaChatCompletion };
