'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import ChatControls from './ChatControls';
import { useWorkspace } from './WorkspaceContext';

export default function ChatPanel() {
  const { chatError, chatMessages, chatLoading, chatInput, setChatInput, sendChat } = useWorkspace();

  return (
    <div>
      <div className="hidden lg:block">
        <div className="text-lg font-semibold">Portfolio Chatbot</div>
        <div className="text-sm text-muted-foreground">Ask questions about the loaded statement data using local Ollama.</div>
      </div>
      <div className="space-y-4">
        {/* The left column owns these on desktop; phones have no such column. */}
        <div className="lg:hidden">
          <ChatControls />
        </div>

        {chatError && <div className="text-sm text-destructive">{chatError}</div>}

        <div className="h-[50vh] space-y-3 overflow-y-auto lg:h-[360px] lg:rounded-xl lg:border lg:p-3">
          {chatMessages.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Ask things like “What is my current net liquidation value?” or “Top 5 holdings by market value”.
            </div>
          )}
          {chatMessages.map((m, i) => (
            <div key={`${m.role}-${i}`} className="space-y-1">
              <div className="text-xs text-muted-foreground">{m.role === 'user' ? 'You' : 'Assistant'}</div>
              <div
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-muted' : 'bg-muted/40'
                }`}
              >
                {m.content}
              </div>
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
