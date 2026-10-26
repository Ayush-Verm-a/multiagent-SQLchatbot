import { apiClient } from "../api/axiosConfig";

class ChatService {
    getApi() {
        return apiClient.get("/");
    }
}

export default new ChatService();