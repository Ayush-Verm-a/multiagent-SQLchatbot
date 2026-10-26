import { useState } from "react";
import { apiClient } from "../api/axiosConfig";
import { useGlobalContext, type ChatItem } from "../context/context";

export default function ChatComponent() {
    const { chatList, setChatList } = useGlobalContext();
    const [query, setQuery] = useState("");

    async function handleQuerySend() {
        if (!query) {
            return;
        }

        const formData = new FormData();
        formData.append("message", query);

        const newChatList = [...chatList];
        try {
            const userChatItem: ChatItem = {
                chatSender: "user",
                msgType: "query",
                chatMsg: query
            }
            newChatList.push(userChatItem);
            setChatList(newChatList);

            const res = await apiClient.post("/api/chat", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const response = res.data;
            
            if(response.generic) {
                const responseChatItem: ChatItem = {
                    chatSender: "bot",
                    msgType: "greeting_response",
                    chatMsg: response.generic
                }; 
                newChatList.push(responseChatItem);
            }
            else {
                const responseChatItem: ChatItem = {
                    chatSender: "bot",
                    msgType: "sql_response",
                    chatMsg: response.explanation + response.query_result + response.sql_query + response.error
                }; 
                newChatList.push(responseChatItem);
            }

            setChatList(newChatList);
            setQuery("");
        } catch (error) {
            const errorChatItem: ChatItem = {
                chatSender: "error",
                msgType: "error_response",
                chatMsg: (error as Error).message,
            };
            newChatList.push(errorChatItem);
            setChatList(newChatList);
            console.log(error);
            setQuery("");
        }
    }

    return (
        <div className="chatbox">
            <div>
                {chatList && chatList.map((chat) => {
                    return (
                        <div>
                            <p
                                className={
                                    chat.chatSender === "bot" ? "red" : "green"
                                }
                            >
                                {chat.chatMsg}
                            </p>
                        </div>
                    );
                })}
            </div>
            <input type="text" onChange={(e) => setQuery(e.target.value)} />
            <button onClick={handleQuerySend}>Send</button>
        </div>
    );
}
