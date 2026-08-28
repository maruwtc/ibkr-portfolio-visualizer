'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useWorkspace } from './WorkspaceContext';

/** Provider, model and session actions for the chatbot. */
export default function ChatControls() {
  const {
    chatProvider,
    setChatProvider,
    chatProviders,
    chatModels,
    chatModel,
    setChatModel,
    refreshChatModels,
    clearChat,
    chatLoading,
  } = useWorkspace();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">Provider</div>
        <Select value={chatProvider} onValueChange={(v) => setChatProvider(v as 'ollama' | 'lmstudio')}>
          <SelectTrigger className="w-full">
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

      <div className="space-y-2">
        <div className="text-sm font-medium">Model</div>
        <Select value={chatModel} onValueChange={setChatModel}>
          <SelectTrigger className="w-full">
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={refreshChatModels} disabled={chatLoading}>
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={clearChat} disabled={chatLoading}>
          Clear Chat
        </Button>
      </div>
    </div>
  );
}
