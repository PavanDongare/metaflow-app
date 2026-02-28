'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Terminal, FileJson, Loader2, Send, CheckCircle2, Plus, Box, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from '@/lib/auth/tenant-context';
import { runGenerate, listConfigs, getConfig } from './actions';

export default function AIBuilderPage() {
  const { tenantId } = useTenant();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [log, setLog] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [configs, setConfigs] = useState<string[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [newConfigName, setNewConfigName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load configs list
  const loadConfigs = useCallback(async () => {
    const list = await listConfigs();
    setConfigs(list);
    // Auto-select first if none selected
    if (list.length > 0 && !selectedConfig && !isCreatingNew) {
      setSelectedConfig(list[0]);
    }
  }, [selectedConfig, isCreatingNew]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Load selected config details
  useEffect(() => {
    if (selectedConfig && !isCreatingNew) {
      getConfig(selectedConfig).then(setConfig);
    }
  }, [selectedConfig, isCreatingNew]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalConfigName = isCreatingNew ? newConfigName : selectedConfig;
    
    if (!prompt.trim() || isGenerating || !finalConfigName) return;

    setIsGenerating(true);
    setStatus('running');
    setLog(prev => prev + `\n> Working on: ${finalConfigName}\n> User: ${prompt}\n🚀 Starting generation...\n`);

    const result = await runGenerate(prompt, tenantId, finalConfigName);

    if (result.success) {
      setLog(prev => prev + result.log + '\n✅ Successfully updated configuration.\n');
      setConfig(result.config);
      setStatus('success');
      setPrompt('');
      if (isCreatingNew) {
        setIsCreatingNew(false);
        setSelectedConfig(finalConfigName);
        loadConfigs();
      }
    } else {
      setLog(prev => prev + (result.log || result.error || 'Unknown error occurred') + '\n❌ Failed to update configuration.\n');
      setStatus('error');
    }
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Top Header */}
      <div className="border-b bg-muted/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Builder</h1>
            <p className="text-xs text-muted-foreground italic tracking-tight">Contextual iterative maintenance</p>
          </div>
        </div>

        {/* Config Selector */}
        <div className="flex items-center gap-3 bg-background p-1 pr-2 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source</span>
          </div>

          {!isCreatingNew ? (
            <div className="flex items-center gap-2">
              <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                <SelectTrigger className="w-[180px] h-9 border-none focus:ring-0 shadow-none font-medium">
                  <SelectValue placeholder="Select config..." />
                </SelectTrigger>
                <SelectContent>
                  {configs.map(c => (
                    <SelectItem key={c} value={c}>{c}.json</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsCreatingNew(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="New project name..."
                value={newConfigName}
                onChange={(e) => setNewConfigName(e.target.value.toLowerCase().replace(/ /g, '-'))}
                className="h-9 w-[180px] border-none shadow-none focus-visible:ring-0"
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={() => setIsCreatingNew(false)} className="h-8">
                Cancel
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {status === 'running' && (
            <Badge variant="outline" className="animate-pulse gap-1.5 py-1 px-3 border-primary/30 bg-primary/5 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </Badge>
          )}
          {status === 'success' && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3 border-green-500/30 bg-green-500/5 text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Synced
            </Badge>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Logs / Chat */}
        <div className="flex-1 flex flex-col border-r bg-black/5">
          <div className="flex-1 relative overflow-hidden flex flex-col p-4 gap-4">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
               <Terminal className="w-3.5 h-3.5" />
               Architect Logs
             </div>
             
             <ScrollArea className="flex-1 bg-black text-zinc-300 font-mono text-xs p-4 rounded-lg border border-zinc-800 shadow-inner">
               <div className="whitespace-pre-wrap leading-relaxed">
                 {log || `System ready. ${selectedConfig ? `Editing ${selectedConfig}.json` : 'Describe a new process to start.'}`}
                 <div ref={logEndRef} />
               </div>
             </ScrollArea>
          </div>

          {/* Bottom Chat Bar */}
          <div className="p-4 bg-background border-t">
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
              <Input
                placeholder={isCreatingNew ? "Describe your new process from scratch..." : `Describe a change to ${selectedConfig}.json...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                className="flex-1 h-12 text-sm bg-muted/40 focus-visible:ring-primary/20"
              />
              <Button type="submit" size="icon" disabled={isGenerating || !prompt.trim() || (!selectedConfig && !newConfigName)} className="h-12 w-12 shrink-0 shadow-lg">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
            <p className="text-[10px] text-center mt-2 text-muted-foreground uppercase tracking-widest font-semibold opacity-50">
              Deterministic architectural maintenance of MetaFlow ontologies
            </p>
          </div>
        </div>

        {/* Right Side: Config Visualizer (Read Only) */}
        <div className="w-[450px] flex flex-col bg-background">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {isCreatingNew ? (newConfigName || 'new-config') : selectedConfig}.json
              </span>
            </div>
            {config && <span className="text-[10px] text-muted-foreground">v{config.version}</span>}
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {config ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Box className="w-3 h-3" /> Entities
                  </h3>
                  <div className="space-y-2">
                    {config.objectTypes?.map((ot: any) => (
                      <div key={ot.symbolicId} className="p-2 border rounded text-xs bg-muted/20">
                        <div className="font-bold flex items-center justify-between">
                          {ot.displayName}
                          <Badge variant="secondary" className="text-[9px] h-4">{ot.processFlag}</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 mb-2 font-mono">
                          {ot.symbolicId}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-1">
                          {Object.keys(ot.config.properties).map(p => (
                            <span key={p} className="bg-background border rounded px-1">{p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> Transitions
                  </h3>
                  <div className="space-y-2">
                    {config.actions?.map((a: any) => (
                      <div key={a.symbolicId} className="p-3 border rounded text-xs hover:bg-muted/10 transition-colors">
                        <div className="font-bold flex items-center justify-between">
                          {a.displayName}
                          <span className="text-[9px] text-muted-foreground font-mono">{a.symbolicId}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1 mb-2 italic">
                          {a.config.description}
                        </div>
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {a.config.parameters?.map((p: any) => (
                            <Badge key={p.name} variant="outline" className="text-[9px] py-0 font-normal">
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8 space-y-4 opacity-50">
                <FileJson className="w-12 h-12" />
                <p className="text-sm">Select an existing config or start a new project to visualize its architecture</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
