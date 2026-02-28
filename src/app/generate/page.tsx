'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Terminal, FileJson, Loader2, Send, CheckCircle2, Plus, Box, FolderOpen, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '@/lib/auth/tenant-context';

const REMOTE_URL = 'http://161.97.133.172:3005';

export default function AIBuilderPage() {
  const { tenantId } = useTenant();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [log, setLog] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [configs, setConfigs] = useState<string[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  
  // New Project Dialog State
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load configs list
  const loadConfigs = useCallback(async () => {
    try {
      const response = await fetch(`${REMOTE_URL}/list`);
      const list = await response.json();
      setConfigs(list);
      if (list.length > 0 && !selectedConfig) {
        setSelectedConfig(list[0]);
      }
    } catch (err) {
      console.error('Failed to load configs from remote server', err);
    }
  }, [selectedConfig]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Load selected config details
  useEffect(() => {
    if (selectedConfig) {
      fetch(`${REMOTE_URL}/config?name=${selectedConfig}`)
        .then(res => res.json())
        .then(setConfig)
        .catch(err => console.error('Failed to load config details', err));
    }
  }, [selectedConfig]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const startGeneration = async (finalPrompt: string, finalConfigName: string, isNew: boolean = false) => {
    if (!finalPrompt.trim() || isGenerating || !finalConfigName) return;

    setIsGenerating(true);
    setStatus('running');
    
    if (isNew) {
      setLog(`🚀 INITIALIZING FRESH PROJECT: ${finalConfigName}\n> Prompt: ${finalPrompt}\n`);
      setConfig(null);
    } else {
      setLog(prev => prev + `\n\n--- UPDATING PROJECT: ${finalConfigName} ---\n> User: ${finalPrompt}\n`);
    }

    try {
      const response = await fetch(`${REMOTE_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, tenantId, configName: finalConfigName, isNew }),
      });

      if (!response.ok) throw new Error('Failed to start generation');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        
        const cleanLog = chunk.replace(/✅ CONFIG_JSON_START[\s\S]*?CONFIG_JSON_END/g, '');
        setLog(prev => prev + cleanLog);

        if (fullText.includes('CONFIG_JSON_START')) {
          const match = fullText.match(/✅ CONFIG_JSON_START\n([\s\S]*?)\nCONFIG_JSON_END/);
          if (match && match[1]) {
            try {
              const updatedConfig = JSON.parse(match[1]);
              setConfig(updatedConfig);
              setStatus('success');
            } catch (e) {
              console.error('Failed to parse config JSON from stream', e);
            }
          }
        }
      }

      if (isNew) {
        setSelectedConfig(finalConfigName);
        await loadConfigs();
      }
      setPrompt('');
    } catch (err: any) {
      setLog(prev => prev + `\n❌ Error: ${err.message}\n`);
      setStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration(prompt, selectedConfig, false);
  };

  const handleCreateNewProject = async () => {
    if (!newProjectName || !newProjectPrompt) return;
    setShowNewDialog(false);
    await startGeneration(newProjectPrompt, newProjectName, true);
    setNewProjectName('');
    setNewProjectPrompt('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      {/* Top Header */}
      <div className="border-b bg-muted/20 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Builder</h1>
            <p className="text-xs text-muted-foreground italic tracking-tight">Regulated lifecycle architect</p>
          </div>
        </div>

        {/* Config Selector */}
        <div className="flex items-center gap-3 bg-background p-1 pr-2 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project</span>
          </div>

          <div className="flex items-center gap-2">
            <Select 
              value={selectedConfig} 
              onValueChange={(val) => {
                if (val === '___new___') {
                  setShowNewDialog(true);
                } else {
                  setSelectedConfig(val);
                }
              }}
            >
              <SelectTrigger className="w-[220px] h-9 border-none focus:ring-0 shadow-none font-medium">
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="___new___" className="text-primary font-bold">
                  <div className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    New Process Blueprint...
                  </div>
                </SelectItem>
                <div className="h-px bg-muted my-1" />
                {configs.map(c => (
                  <SelectItem key={c} value={c}>{c}.json</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary shrink-0" 
              onClick={() => setShowNewDialog(true)}
              title="Create new project"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {status === 'running' && (
            <Badge variant="outline" className="animate-pulse gap-1.5 py-1 px-3 border-primary/30 bg-primary/5 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Streaming Architecture...
            </Badge>
          )}
          {status === 'success' && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3 border-green-500/30 bg-green-500/5 text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Live Synced
            </Badge>
          )}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Side: Logs / Chat */}
        <div className="flex-1 flex flex-col border-r bg-black/5 min-h-0">
          <div className="flex-1 relative overflow-hidden flex flex-col p-4 gap-4 min-h-0">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 shrink-0">
               <Terminal className="w-3.5 h-3.5" />
               Architect Terminal
             </div>
             
             <ScrollArea className="flex-1 bg-black text-zinc-300 font-mono text-xs p-4 rounded-lg border border-zinc-800 shadow-inner">
               <div className="whitespace-pre-wrap leading-relaxed pb-4">
                 {log || `System ready. Select a project or create a new one to begin.`}
                 <div ref={logEndRef} />
               </div>
             </ScrollArea>
          </div>

          {/* Bottom Chat Bar */}
          <div className="p-4 bg-background border-t shrink-0">
            <form onSubmit={handleUpdateSubmit} className="flex gap-2 max-w-4xl mx-auto">
              <Input
                placeholder={`Request an update to ${selectedConfig}.json...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating || !selectedConfig}
                className="flex-1 h-12 text-sm bg-muted/40 focus-visible:ring-primary/20"
              />
              <Button type="submit" size="icon" disabled={isGenerating || !prompt.trim() || !selectedConfig} className="h-12 w-12 shrink-0 shadow-lg">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
            <p className="text-[10px] text-center mt-2 text-muted-foreground uppercase tracking-widest font-semibold opacity-50">
              Deterministic architectural maintenance of MetaFlow ontologies
            </p>
          </div>
        </div>

        {/* Right Side: Config Visualizer */}
        <div className="w-[450px] flex flex-col bg-background min-h-0 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">
          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold truncate">
                {selectedConfig}.json
              </span>
            </div>
            {config && <Badge variant="secondary" className="text-[9px]">v{config.version}</Badge>}
          </div>
          
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 pb-20">
              {config ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <Box className="w-3 h-3" /> Object Model
                    </h3>
                    <div className="space-y-3">
                      {config.objectTypes?.map((ot: any) => (
                        <div key={ot.symbolicId} className="p-3 border rounded-lg text-xs bg-muted/20 shadow-sm">
                          <div className="font-bold flex items-center justify-between gap-2 mb-1">
                            <span className="truncate">{ot.displayName}</span>
                            <Badge variant="secondary" className="text-[9px] h-4 shrink-0 px-1.5 uppercase font-bold">{ot.processFlag}</Badge>
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono mb-2 opacity-70">
                            {ot.symbolicId}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(ot.config.properties).map(p => (
                              <span key={p} className="bg-background border rounded px-1.5 py-0.5 text-[10px] text-zinc-600">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> State Transitions
                    </h3>
                    <div className="space-y-3">
                      {config.actions?.map((a: any) => (
                        <div key={a.symbolicId} className="p-3 border rounded-lg text-xs hover:bg-muted/10 transition-colors shadow-sm bg-background">
                          <div className="font-bold flex items-center justify-between gap-2">
                            <span className="truncate">{a.displayName}</span>
                            <span className="text-[9px] text-muted-foreground font-mono shrink-0">{a.symbolicId}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-relaxed mt-2 mb-2 italic border-l-2 pl-2 border-muted">
                            {a.config.description}
                          </div>
                          {a.config.parameters && a.config.parameters.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mt-3 pt-2 border-t border-dashed">
                              {a.config.parameters.map((p: any) => (
                                <Badge key={p.name} variant="outline" className="text-[9px] py-0 font-normal bg-muted/30">
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground text-center p-8 space-y-4 opacity-50">
                  <FileJson className="w-12 h-12" />
                  <p className="text-sm">Select a project to visualize its architectural model</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              New Process Blueprint
            </DialogTitle>
            <DialogDescription>
              Describe your business process in detail. Gemini will architect the object model, relationships, and lifecycle actions from scratch.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Name</label>
              <Input 
                placeholder="e.g., inventory-management" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="font-mono bg-muted/30"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Detailed Prompt</label>
              <Textarea 
                placeholder="Describe the entities, their properties, and how they should move through a lifecycle (e.g., 'Draft -> Approved -> Published')..." 
                className="min-h-[200px] text-sm leading-relaxed bg-muted/30"
                value={newProjectPrompt}
                onChange={(e) => setNewProjectPrompt(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button 
              disabled={!newProjectName || !newProjectPrompt || isGenerating}
              onClick={handleCreateNewProject}
              className="gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Architecture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
