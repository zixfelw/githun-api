import * as vscode from 'vscode';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    model?: string;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    model: string;
    createdAt: number;
    updatedAt: number;
}

export interface AppConfig {
    apiUrl: string;
    apiKey: string;
    defaultModel: string;
    maxTokens: number;
    temperature: number;
    streamResponse: boolean;
}

export class StorageManager {
    private readonly CONVERSATIONS_KEY = 'genspark.conversations';
    private readonly CURRENT_CONV_KEY = 'genspark.currentConversationId';
    private readonly CONFIG_KEY = 'genspark.config';

    constructor(private context: vscode.ExtensionContext) {}

    // --- Conversations ---
    getAllConversations(): Conversation[] {
        return this.context.globalState.get<Conversation[]>(this.CONVERSATIONS_KEY, []);
    }

    saveConversation(conv: Conversation): void {
        const all = this.getAllConversations();
        const idx = all.findIndex(c => c.id === conv.id);
        if (idx >= 0) {
            all[idx] = conv;
        } else {
            all.unshift(conv); // newest first
        }
        // Keep only last 100 conversations
        const trimmed = all.slice(0, 100);
        this.context.globalState.update(this.CONVERSATIONS_KEY, trimmed);
    }

    getConversation(id: string): Conversation | undefined {
        return this.getAllConversations().find(c => c.id === id);
    }

    deleteConversation(id: string): void {
        const all = this.getAllConversations().filter(c => c.id !== id);
        this.context.globalState.update(this.CONVERSATIONS_KEY, all);
        if (this.getCurrentConversationId() === id) {
            this.context.globalState.update(this.CURRENT_CONV_KEY, undefined);
        }
    }

    clearAllConversations(): void {
        this.context.globalState.update(this.CONVERSATIONS_KEY, []);
        this.context.globalState.update(this.CURRENT_CONV_KEY, undefined);
    }

    // --- Current conversation ---
    getCurrentConversationId(): string | undefined {
        return this.context.globalState.get<string>(this.CURRENT_CONV_KEY);
    }

    setCurrentConversationId(id: string | undefined): void {
        this.context.globalState.update(this.CURRENT_CONV_KEY, id);
    }

    // --- Config ---
    getConfig(): AppConfig {
        const vsConfig = vscode.workspace.getConfiguration('genspark-coder');
        const saved = this.context.globalState.get<Partial<AppConfig>>(this.CONFIG_KEY, {});
        return {
            apiUrl: saved.apiUrl || vsConfig.get('apiUrl', 'https://genspark-beta.up.railway.app'),
            apiKey: saved.apiKey || vsConfig.get('apiKey', 'test123456'),
            defaultModel: saved.defaultModel || vsConfig.get('defaultModel', 'claude-sonnet-4-6'),
            maxTokens: saved.maxTokens || vsConfig.get('maxTokens', 8192),
            temperature: saved.temperature ?? vsConfig.get('temperature', 0.7),
            streamResponse: saved.streamResponse ?? vsConfig.get('streamResponse', true),
        };
    }

    saveConfig(config: Partial<AppConfig>): void {
        const current = this.getConfig();
        const updated = { ...current, ...config };
        this.context.globalState.update(this.CONFIG_KEY, updated);
    }

    // --- Helper ---
    generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}
