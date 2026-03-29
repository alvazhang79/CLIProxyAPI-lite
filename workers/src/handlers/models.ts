import type { Context } from 'hono';
import { getBuiltinModels, listAllModels } from '../db/d1';

export async function handleListModels(c: Context) {
  const d1 = c.get('D1');

  // Get built-in models
  const builtin = getBuiltinModels();

  // Get custom models from D1
  let customModels: Array<{
    id: string; alias: string; display_name: string;
    api_format: string; context_window: number | null; enabled: boolean;
  }> = [];
  try {
    const results = await listAllModels(d1);
    customModels = results.map(m => ({
      id: m.alias,
      alias: m.alias,
      display_name: m.display_name || m.alias,
      api_format: m.api_format,
      context_window: m.context_window,
      enabled: m.enabled,
    }));
  } catch {
    // D1 might not be set up yet in dev
  }

  const allModels = [
    ...builtin.map(m => ({
      id: m.id,
      object: 'model',
      type: 'chat',
      display_name: m.display_name,
      owned_by: m.id.split('-')[0],
    })),
    ...customModels.filter(m => m.enabled).map(m => ({
      id: m.alias,
      object: 'model',
      type: 'chat',
      display_name: m.display_name,
      owned_by: 'custom',
    })),
  ];

  return c.json({
    object: 'list',
    data: allModels,
  });
}
