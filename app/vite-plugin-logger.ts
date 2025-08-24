import type { Plugin } from 'vite';

export function pluginLogger(): Plugin {
  return {
    name: 'vite-plugin-logger',
    configResolved(config) {
      console.log('\n' + '='.repeat(60));
      console.log('🔌 VITE PLUGINS LOADED:');
      console.log('='.repeat(60));
      
      config.plugins.forEach((plugin, index) => {
        const pluginName = (plugin as any).name || `Unknown Plugin ${index + 1}`;
        console.log(`  ${(index + 1).toString().padStart(2, '0')}. ${pluginName}`);
      });
      
      console.log('='.repeat(60));
      console.log('📁 Configuration:');
      console.log(`  • Base Path: ${config.base}`);
      console.log(`  • Mode: ${config.mode}`);
      console.log(`  • Build Command: ${config.command}`);
      console.log(`  • Dev Server Port: ${config.server?.port || 'default'}`);
      console.log('='.repeat(60) + '\n');
    }
  };
}