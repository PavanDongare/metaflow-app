import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function getProjectFlags() {
  const { data, error } = await supabase
    .schema('metaflow')
    .from('project_snapshots')
    .select('process_flag');
  
  if (error) throw error;
  return data.map(i => i.process_flag);
}

export async function getProjectSnapshot(processFlag: string) {
  const { data, error } = await supabase
    .schema('metaflow')
    .from('project_snapshots')
    .select('config')
    .eq('process_flag', processFlag)
    .single();
  
  if (error) return null;
  return data.config;
}

export async function upsertProjectSnapshot(processFlag: string, tenantId: string, config: any) {
  const { error } = await supabase
    .schema('metaflow')
    .from('project_snapshots')
    .upsert({
      process_flag: processFlag,
      tenant_id: tenantId,
      config,
      updated_at: new Date().toISOString()
    });
  
  if (error) throw error;
}
