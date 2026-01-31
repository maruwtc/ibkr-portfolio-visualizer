'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from './WorkspaceContext';

export default function ChatPanel() {
  const {
    chatProvider,
    setChatProvider,
    chatProviders,
    chatModels,
    chatModel,
    setChatModel,
    refreshChatModels,
    clearChat,
    chatError,
    chatMessages,
    chatLoading,
    chatInput,
    setChatInput,
    sendChat,
  } = useWorkspace();

  return (
    <div>
      <div className="text-lg font-semibold">Portfolio Chatbot</div>
      <div className="text-sm text-muted-foreground">Ask questions about the loaded CSV data using local Ollama.</div>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">Provider</div>
          <div className="flex items-center gap-2">
            <Select value={chatProvider} onValueChange={(v) => setChatProvider(v as any)}>
              <SelectTrigger className="max-w-[200px]">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lmstudio">LM Studio</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {chatProviders.lmstudio ? 'LM Studio ready' : 'LM Studio not detected'} ·{' '}
              {chatProviders.ollama ? 'Ollama ready' : 'Ollama not detected'}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">Model</div>
          <div className="flex items-center gap-2">
            <Select value={chatModel} onValueChange={setChatModel}>
              <SelectTrigger className="max-w-[260px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {chatModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={refreshChatModels}>
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={clearChat}>
              Clear Chat
            </Button>
          </div>
          {chatError && <div className="text-sm text-destructive">{chatError}</div>}
        </div>

        <div className="rounded-xl border p-3 h-[360px] overflow-y-auto space-y-3">
          {chatMessages.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Ask things like “What is my current net liquidation value?” or “Top 5 holdings by market value”.
            </div>
          )}
          {chatMessages.map((m, i) => (
            <div key={`${m.role}-${i}`} className="space-y-1">
              <div className="text-xs text-muted-foreground">{m.role === 'user' ? 'You' : 'Assistant'}</div>
              <div className="rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {chatLoading && <div className="text-sm text-muted-foreground">Thinking…</div>}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ask about your portfolio..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendChat();
            }}
          />
          <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
