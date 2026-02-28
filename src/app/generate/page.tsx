'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Terminal, FileJson, Loader2, Send, CheckCircle2, Plus, Box, FolderOpen, Wand2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '@/lib/auth/tenant-context';
import { getProjectFlags, getProjectSnapshot, upsertProjectSnapshot } from '../lib/queries/snapshots';

const COMPUTE_URL = 'http://161.97.133.172:3005';

export default function AIBuilderPage() {
  const { tenantId } = useTenant();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [log, setLog] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [projectFlags, setProjectFlags] = useState<string[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<string>('');
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadFlags = useCallback(async () => {
    try {
      const flags = await getProjectFlags();
      setProjectFlags(flags);
      if (flags.length > 0 && !selectedFlag) {
        setSelectedFlag(flags[0]);
      }
    } catch (err) {
      console.error('Failed to load project flags', err);
    }
  }, [selectedFlag]);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  useEffect(() => {
    if (selectedFlag) {
      getProjectSnapshot(selectedFlag).then(setConfig);
    }
  }, [selectedFlag]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const startGeneration = async (finalPrompt: string, flag: string, isNew: boolean = false) => {
    if (!finalPrompt.trim() || isGenerating || !flag) return;

    setIsGenerating(true);
    setStatus('running');
    
    if (isNew) {
      setLog(`🚀 INITIALIZING FRESH PROJECT: ${flag}\n> Prompt: ${finalPrompt}\n`);
      setConfig(null);
    } else {
      setLog(prev => prev + `\n\n--- UPDATING PROCESS: ${flag} ---\n> User: ${finalPrompt}\n`);
    }

    try {
      const response = await fetch(`${COMPUTE_URL}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: finalPrompt, 
          currentConfig: isNew ? { version: 1, objectTypes: [], relationships: [], actions: [], processLayouts: [] } : config 
        }),
      });

      if (!response.ok) throw new Error('Compute node unavailable');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream reader available');

      const decoder = new TextDecoder();
      let fullText = '';
      let updatedConfig = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        
        const cleanLog = chunk.replace(/✅ TRANSFORMATION_COMPLETE[\s\S]*?TRANSFORMATION_END/g, '');
        setLog(prev => prev + cleanLog);

        if (fullText.includes('TRANSFORMATION_COMPLETE')) {
          const match = fullText.match(/✅ TRANSFORMATION_COMPLETE\n([\s\S]*?)\nTRANSFORMATION_END/);
          if (match && match[1]) {
            try {
              updatedConfig = JSON.parse(match[1]);
              setConfig(updatedConfig);
            } catch (e) {
              console.error('Failed to parse updated config', e);
            }
          }
        }
      }

      if (updatedConfig) {
        setLog(prev => prev + '📦 Finalizing architecture in database...\n');
        // 1. Update Snapshot in DB
        await upsertProjectSnapshot(flag, tenantId, updatedConfig);
        
        // 2. Note: Ideally we call a "Sync Normalized Tables" script here
        // For now, since the apply script is on the server, we might need a /sync endpoint
        // or just let the user know it's saved as a snapshot.
        
        setLog(prev => prev + `✅ Project ${flag} synchronized to Supabase.\n`);
        setStatus('success');
        if (isNew) {
          setSelectedFlag(flag);
          await loadFlags();
        }
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
    startGeneration(prompt, selectedFlag, false);
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
      {/* Header */}
      <div className="border-b bg-muted/20 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Builder</h1>
            <p className="text-xs text-muted-foreground italic">Stateless Compute • DB-as-Source</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background p-1 pr-2 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source</span>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedFlag} onValueChange={(val) => val === '___new___' ? setShowNewDialog(true) : setSelectedFlag(val)}>
              <SelectTrigger className="w-[220px] h-9 border-none focus:ring-0 shadow-none font-medium italic">
                <SelectValue placeholder="Select active process..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="___new___" className="text-primary font-bold">
                  <Plus className="w-3.5 h-3.5 inline mr-2" /> New Process Blueprint...
                </SelectItem>
                <div className="h-px bg-muted my-1" />
                {projectFlags.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {status === 'running' && (
            <Badge variant="outline" className="animate-pulse gap-1.5 py-1 px-3 border-primary/30 bg-primary/5 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> Computing...
            </Badge>
          )}
          {status === 'success' && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3 border-green-500/30 bg-green-500/5 text-green-600">
              <CheckCircle2 className="w-3 h-3" /> Synced to DB
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Logs */}
        <div className="flex-1 flex flex-col border-r bg-black/5 min-h-0">
          <div className="flex-1 relative overflow-hidden flex flex-col p-4 gap-4 min-h-0">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 shrink-0">
               <Terminal className="w-3.5 h-3.5" /> Architect Logs
             </div>
             <ScrollArea className="flex-1 bg-black text-zinc-300 font-mono text-xs p-4 rounded-lg border border-zinc-800 shadow-inner">
               <div className="whitespace-pre-wrap leading-relaxed pb-4">
                 {log || `Stateless system ready. Select a process from Supabase to begin.`}
                 <div ref={logEndRef} />
               </div>
             </ScrollArea>
          </div>

          <div className="p-4 bg-background border-t shrink-0">
            <form onSubmit={handleUpdateSubmit} className="flex gap-2 max-w-4xl mx-auto">
              <Input
                placeholder={`Request architecture update for ${selectedFlag}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating || !selectedFlag}
                className="flex-1 h-12 text-sm bg-muted/40 focus-visible:ring-primary/20"
              />
              <Button type="submit" size="icon" disabled={isGenerating || !prompt.trim() || !selectedFlag} className="h-12 w-12 shrink-0 shadow-lg">
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
          </div>
        </div>

        {/* Visualizer */}
        <div className="w-[450px] flex flex-col bg-background min-h-0 shadow-inner">
          <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold truncate">{selectedFlag || 'No Process'}</span>
            </div>
            {config && <Badge variant="secondary" className="text-[9px]">v{config.version}</Badge>}
          </div>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 pb-20">
              {config ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Box className="w-3 h-3" /> Object Model</h3>
                    <div className="space-y-3">
                      {config.objectTypes?.map((ot: any) => (
                        <div key={ot.symbolicId} className="p-3 border rounded-lg text-xs bg-muted/20 shadow-sm">
                          <div className="font-bold flex items-center justify-between gap-2 mb-1">
                            <span className="truncate">{ot.displayName}</span>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-bold">{ot.processFlag}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.keys(ot.config.properties).map(p => <span key={p} className="bg-background border rounded px-1.5 py-0.5 text-[10px]">{p}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Transitions</h3>
                    <div className="space-y-3">
                      {config.actions?.map((a: any) => (
                        <div key={a.symbolicId} className="p-3 border rounded-lg text-xs bg-background shadow-sm">
                          <div className="font-bold">{a.displayName}</div>
                          <div className="text-[10px] text-muted-foreground italic mt-1">{a.config.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground text-center p-8 opacity-50">
                  <FileJson className="w-12 h-12 mb-4" />
                  <p className="text-sm">Select a process to visualize its architectural model</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-primary" /> New Process Blueprint</DialogTitle>
            <DialogDescription>Gemini will architect the object model and lifecycle actions from scratch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase text-muted-foreground">Process Name (Flag)</label>
              <Input placeholder="e.g., inventory-management" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase text-muted-foreground">Detailed Prompt</label>
              <Textarea placeholder="Describe entities, properties, and transitions..." className="min-h-[200px]" value={newProjectPrompt} onChange={(e) => setNewProjectPrompt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button disabled={!newProjectName || !newProjectPrompt || isGenerating} onClick={handleCreateNewProject} className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate Architecture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
